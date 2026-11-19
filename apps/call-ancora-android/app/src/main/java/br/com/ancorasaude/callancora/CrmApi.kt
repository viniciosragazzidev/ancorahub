package br.com.ancorasaude.callancora

import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Estado da sessão como o servidor manda para o app (número só quando discável). */
data class CrmContact(val id: String, val name: String, val dialable: Boolean, val phone: String?)
data class CrmNext(val id: String, val name: String, val phoneMasked: String?)
data class CrmLastCall(
    val causeLabel: String?,
    val reachedActive: Boolean,
    val talkSeconds: Int,
    val noAnswer: Boolean,
    val voicemail: Boolean,
)

data class CrmState(
    val sessionId: String,
    val brokerFirstName: String,
    val status: String,
    val callStatus: String,
    val autoDialEnabled: Boolean,
    val paused: Boolean,
    val awaitingClassification: Boolean,
    val countdownSeconds: Int?,
    val countdownPaused: Boolean,
    val completed: Int,
    val total: Int,
    val current: CrmContact?,
    val next: CrmNext?,
    val lastCall: CrmLastCall?,
    /** "voicemail": a web pediu para desligar a ligação atual como caixa postal. */
    val hangupRequest: String?,
)

/** Resultado do QR: de onde veio (origem) e o ticket de uso único. */
data class QrTicket(val origin: String, val ticket: String)

class CrmException(message: String, val status: Int = 0) : Exception(message) {
    /** 401/403: o token não vale mais (sessão reiniciada na web ou flag desligada). */
    val sessionEnded: Boolean get() = status == 401 || status == 403
}

/** Cliente HTTP da API do app (/api/call-ancora/device/...). Sem bibliotecas externas. */
class CrmApi(private val origin: String, private val token: String?) {

    companion object {
        const val PRODUCTION_HOST = "crm.ancorasaude.cloud"
        private val TICKET = Regex("^[A-Za-z0-9_-]{40,80}$")

        /**
         * Lê a URL do QR (…/call-ancora/celular?t=…). Só aceita o CRM de produção (https)
         * ou endereços de desenvolvimento (localhost, emulador e rede local).
         */
        fun parseQr(text: String): QrTicket? {
            val uri = runCatching { Uri.parse(text.trim()) }.getOrNull() ?: return null
            val scheme = uri.scheme?.lowercase() ?: return null
            val host = uri.host?.lowercase() ?: return null
            if (uri.path?.trimEnd('/') != "/call-ancora/celular") return null
            val ticket = uri.getQueryParameter("t") ?: return null
            if (!TICKET.matches(ticket)) return null
            val allowed = when {
                host == PRODUCTION_HOST -> scheme == "https"
                isDevHost(host) -> scheme == "https" || scheme == "http"
                else -> false
            }
            if (!allowed) return null
            val port = if (uri.port > 0) ":${uri.port}" else ""
            return QrTicket("$scheme://$host$port", ticket)
        }

        private fun isDevHost(host: String): Boolean {
            if (host == "localhost" || host == "127.0.0.1" || host == "10.0.2.2") return true
            val parts = host.split('.').mapNotNull { it.toIntOrNull() }
            if (parts.size != 4 || parts.any { it !in 0..255 }) return false
            return parts[0] == 10 ||
                (parts[0] == 192 && parts[1] == 168) ||
                (parts[0] == 172 && parts[1] in 16..31)
        }

        fun parseState(json: JSONObject): CrmState {
            val s = json.getJSONObject("state")
            val current = s.optJSONObject("current")?.let {
                CrmContact(
                    id = it.getString("id"),
                    name = it.optString("name"),
                    dialable = it.optBoolean("dialable", false),
                    phone = if (it.isNull("phone")) null else it.optString("phone").ifBlank { null },
                )
            }
            val next = s.optJSONObject("next")?.let {
                CrmNext(it.getString("id"), it.optString("name"), if (it.isNull("phoneMasked")) null else it.optString("phoneMasked"))
            }
            val countdown = s.optJSONObject("countdown")
            val last = s.optJSONObject("lastCall")?.let {
                CrmLastCall(
                    causeLabel = if (it.isNull("causeLabel")) null else it.optString("causeLabel"),
                    reachedActive = it.optBoolean("reachedActive"),
                    talkSeconds = it.optInt("talkSeconds"),
                    noAnswer = it.optString("autoOutcome") == "no_answer",
                    voicemail = it.optString("autoOutcome") == "voicemail",
                )
            }
            return CrmState(
                sessionId = s.optString("sessionId"),
                brokerFirstName = s.optString("brokerFirstName"),
                status = s.optString("status"),
                callStatus = s.optString("callStatus"),
                autoDialEnabled = s.optBoolean("autoDialEnabled"),
                paused = s.optBoolean("paused"),
                awaitingClassification = s.optBoolean("awaitingClassification"),
                countdownSeconds = countdown?.optInt("remainingSeconds"),
                countdownPaused = countdown?.optBoolean("paused") ?: false,
                completed = s.optInt("completed"),
                total = s.optInt("total"),
                current = current,
                next = next,
                lastCall = last,
                hangupRequest = if (s.isNull("hangupRequest")) null else s.optString("hangupRequest").ifBlank { null },
            )
        }
    }

    data class PairResult(val deviceToken: String, val brokerFirstName: String, val sessionId: String, val state: CrmState)

    suspend fun pair(ticket: String): PairResult {
        val json = request("POST", "/api/call-ancora/device/pair", JSONObject().put("token", ticket), auth = false)
        return PairResult(
            deviceToken = json.getString("deviceToken"),
            brokerFirstName = json.optString("brokerFirstName"),
            sessionId = json.optString("sessionId"),
            state = parseState(json),
        )
    }

    suspend fun state(): CrmState = parseState(request("GET", "/api/call-ancora/device/state", null))

    suspend fun event(body: JSONObject): CrmState = parseState(request("POST", "/api/call-ancora/device/events", body))

    suspend fun control(action: String): CrmState =
        parseState(request("POST", "/api/call-ancora/device/control", JSONObject().put("action", action)))

    private suspend fun request(method: String, path: String, body: JSONObject?, auth: Boolean = true): JSONObject =
        withContext(Dispatchers.IO) {
            val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 8_000
                readTimeout = 8_000
                useCaches = false
                setRequestProperty("Accept", "application/json")
                if (auth && token != null) setRequestProperty("Authorization", "Bearer $token")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            try {
                if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
                if (status !in 200..299) {
                    throw CrmException(json.optString("error").ifBlank { "O servidor respondeu $status." }, status)
                }
                json
            } catch (e: IOException) {
                throw CrmException("Sem conexão com o AncoraHub. Confira a internet do celular.")
            } finally {
                connection.disconnect()
            }
        }
}
