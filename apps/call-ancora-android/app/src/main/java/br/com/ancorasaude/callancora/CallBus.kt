package br.com.ancorasaude.callancora

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.DisconnectCause
import android.telecom.VideoProfile
import android.telephony.TelephonyManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Uma linha do registro: quando aconteceu, quanto tempo depois do pedido de ligação e o que foi.
 * [event] e [detail] formam o registro técnico (Copiar/Enviar). Os demais campos só alimentam a
 * linha do tempo amigável da tela e não mudam o texto exportado.
 */
data class LogEntry(
    val wallClockMs: Long,
    val sinceDialMs: Long?,
    val number: String,
    val event: String,
    val detail: String? = null,
    val state: Int? = null,
    val incoming: Boolean = false,
    val causeCode: Int? = null,
    val activeMs: Long? = null,
    val scenario: String? = null,
)

/** Foto da ligação atual, usada pela tela de chamada. */
data class CallSnapshot(
    val number: String,
    val state: Int,
    val isIncoming: Boolean,
    val connectTimeMillis: Long,
    val addedAtElapsed: Long,
    val disconnectLabel: String?,
    val disconnectCode: Int? = null,
    /** ms entre o pedido de ligação (ou a chegada da recebida) e o primeiro ACTIVE. */
    val timeToActiveMs: Long? = null,
    /** ms em ACTIVE até o DISCONNECTED. */
    val talkMs: Long? = null,
)

data class AudioSnapshot(val muted: Boolean = false, val speaker: Boolean = false)

/**
 * Barramento simples, só dentro do processo do app: o [CallService] publica e as telas observam.
 * Nada é gravado em disco nem enviado para fora.
 */
object CallBus {
    const val EVENT_DIAL_REQUEST = "PEDIDO_DE_LIGACAO"
    const val EVENT_ADDED_PREFIX = "ADICIONADA:"
    const val EVENT_REMOVED = "REMOVIDA"
    const val EVENT_NOTE = "AVISO"

    private const val MAX_LOG = 500
    /** Um pedido de ligação feito há mais que isso não serve de referência para a próxima chamada. */
    private const val DIAL_REFERENCE_WINDOW_MS = 30_000L

    private val _log = MutableStateFlow<List<LogEntry>>(emptyList())
    val log: StateFlow<List<LogEntry>> = _log.asStateFlow()

    private val _current = MutableStateFlow<CallSnapshot?>(null)
    val current: StateFlow<CallSnapshot?> = _current.asStateFlow()

    private val _audio = MutableStateFlow(AudioSnapshot())
    val audio: StateFlow<AudioSnapshot> = _audio.asStateFlow()

    @Volatile private var dialStartedAtElapsed: Long? = null
    @Volatile internal var service: CallService? = null
    @Volatile private var activeCall: Call? = null

    // Medidas da ligação atual, para o resumo da tela de chamada.
    @Volatile private var activeAtElapsed: Long? = null
    @Volatile private var timeToActiveMs: Long? = null
    @Volatile private var talkMs: Long? = null

    // ---------- Eventos vindos da tela principal ----------

    fun markDialRequested(number: String, scenario: String) {
        dialStartedAtElapsed = SystemClock.elapsedRealtime()
        val clean = scenario.trim().takeIf { it.isNotEmpty() }
        val detail = clean?.let { "cenário: $it" }
        append(number, EVENT_DIAL_REQUEST, detail, scenario = clean)
    }

    fun note(message: String) = append("-", EVENT_NOTE, message)

    /** Evento livre no registro técnico (passos da discagem automática). */
    fun logEvent(event: String, number: String, detail: String?) = append(number, event, detail)

    /** Há alguma ligação deste app ainda não encerrada? */
    fun hasLiveCall(): Boolean {
        val calls = service?.calls ?: return false
        return calls.any { stateOf(it) != Call.STATE_DISCONNECTED }
    }

    fun clearLog() {
        _log.value = emptyList()
    }

    // ---------- Eventos vindos do InCallService ----------

    internal fun onCallAdded(call: Call) {
        val now = SystemClock.elapsedRealtime()
        val incoming = isIncoming(call)
        val ref = dialStartedAtElapsed
        if (incoming || ref == null || now - ref > DIAL_REFERENCE_WINDOW_MS) {
            // Ligação recebida ou iniciada fora do app: o relógio começa agora.
            dialStartedAtElapsed = now
        }
        activeCall = call
        activeAtElapsed = null
        timeToActiveMs = null
        talkMs = null
        val state = stateOf(call)
        append(
            numberOf(call),
            EVENT_ADDED_PREFIX + stateName(state),
            if (incoming) "recebida" else "feita",
            state = state,
            incoming = incoming,
        )
        if (state == Call.STATE_ACTIVE) markActive(now)
        publish(call, now)
        if (incoming) AutoDialer.onIncomingCall() else AutoDialer.onOutgoingAdded()
    }

    internal fun onStateChanged(call: Call, state: Int) {
        val now = SystemClock.elapsedRealtime()
        val isCurrent = call == activeCall
        var causeCode: Int? = null
        var activeMs: Long? = null
        val detail = when (state) {
            Call.STATE_ACTIVE -> {
                if (isCurrent) markActive(now)
                val connect = call.details.connectTimeMillis
                if (connect > 0) "connectTimeMillis=$connect" else null
            }
            Call.STATE_DISCONNECTED -> {
                causeCode = call.details.disconnectCause?.code
                val connect = call.details.connectTimeMillis
                activeMs = if (connect > 0) System.currentTimeMillis() - connect else null
                if (isCurrent) talkMs = activeAtElapsed?.let { now - it }
                describeDisconnect(call)
            }
            else -> null
        }
        append(
            numberOf(call),
            stateName(state),
            detail,
            state = state,
            incoming = isIncoming(call),
            causeCode = causeCode,
            activeMs = activeMs,
        )
        if (isCurrent) publish(call, _current.value?.addedAtElapsed)
        if (state == Call.STATE_DISCONNECTED && !isIncoming(call)) {
            val answered = call.details.connectTimeMillis > 0 || (isCurrent && timeToActiveMs != null)
            AutoDialer.onOutgoingEnded(answered, if (isCurrent) talkMs else activeMs)
        }
    }

    internal fun onDetailsChanged(call: Call) {
        if (call == activeCall) publish(call, _current.value?.addedAtElapsed)
    }

    internal fun onCallRemoved(call: Call) {
        append(numberOf(call), EVENT_REMOVED, null)
        if (call == activeCall) {
            activeCall = null
            _current.value = _current.value?.copy(state = Call.STATE_DISCONNECTED)
        }
    }

    internal fun onAudioStateChanged(state: CallAudioState) {
        _audio.value = AudioSnapshot(
            muted = state.isMuted,
            speaker = state.route == CallAudioState.ROUTE_SPEAKER,
        )
    }

    // ---------- Ações da tela de chamada ----------

    fun answer() {
        activeCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
    }

    fun hangup() {
        val call = activeCall ?: return
        if (stateOf(call) == Call.STATE_RINGING && isIncoming(call)) {
            call.reject(false, null)
        } else {
            call.disconnect()
        }
    }

    fun toggleMute() {
        service?.setMuted(!_audio.value.muted)
    }

    @Suppress("DEPRECATION")
    fun toggleSpeaker() {
        val route = if (_audio.value.speaker) {
            CallAudioState.ROUTE_WIRED_OR_EARPIECE
        } else {
            CallAudioState.ROUTE_SPEAKER
        }
        service?.setAudioRoute(route)
    }

    // ---------- Exportação (registro técnico, formato fixo) ----------

    fun formatLog(context: Context): String {
        val fmt = SimpleDateFormat("dd/MM/yyyy HH:mm:ss.SSS", Locale("pt", "BR"))
        val operator = runCatching {
            (context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager).networkOperatorName
        }.getOrNull().orEmpty().ifBlank { "desconhecida" }
        val header = buildString {
            appendLine("Call Âncora: registro da prova do discador")
            appendLine("Gerado em: ${fmt.format(Date())}")
            appendLine("Aparelho: ${Build.MANUFACTURER} ${Build.MODEL} | Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            appendLine("Operadora da rede: $operator")
            appendLine("Colunas: horário | ms desde o pedido de ligação | número | evento | detalhe")
            appendLine("----")
        }
        return header + _log.value.joinToString("\n") { formatLine(it, fmt) }
    }

    fun formatLine(e: LogEntry, fmt: SimpleDateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale("pt", "BR"))): String {
        val since = e.sinceDialMs?.let { "+${it}ms" } ?: "-"
        val detail = e.detail?.let { " | $it" } ?: ""
        return "${fmt.format(Date(e.wallClockMs))} | $since | ${e.number} | ${e.event}$detail"
    }

    // ---------- Apoio ----------

    private fun markActive(now: Long) {
        if (activeAtElapsed != null) return
        activeAtElapsed = now
        timeToActiveMs = dialStartedAtElapsed?.let { now - it }
    }

    private fun append(
        number: String,
        event: String,
        detail: String?,
        state: Int? = null,
        incoming: Boolean = false,
        causeCode: Int? = null,
        activeMs: Long? = null,
        scenario: String? = null,
    ) {
        val ref = dialStartedAtElapsed
        val since = ref?.let { SystemClock.elapsedRealtime() - it }
        val entry = LogEntry(
            wallClockMs = System.currentTimeMillis(),
            sinceDialMs = since,
            number = number,
            event = event,
            detail = detail,
            state = state,
            incoming = incoming,
            causeCode = causeCode,
            activeMs = activeMs,
            scenario = scenario,
        )
        _log.value = (_log.value + entry).takeLast(MAX_LOG)
    }

    private fun publish(call: Call, addedAt: Long?) {
        val state = stateOf(call)
        val cause = if (state == Call.STATE_DISCONNECTED) call.details.disconnectCause else null
        _current.value = CallSnapshot(
            number = numberOf(call),
            state = state,
            isIncoming = isIncoming(call),
            connectTimeMillis = call.details.connectTimeMillis,
            addedAtElapsed = addedAt ?: SystemClock.elapsedRealtime(),
            disconnectLabel = cause?.label?.toString()?.takeIf { it.isNotBlank() }
                ?: cause?.let { causeName(it.code) },
            disconnectCode = cause?.code,
            timeToActiveMs = timeToActiveMs,
            talkMs = talkMs,
        )
    }

    private fun describeDisconnect(call: Call): String {
        val cause = call.details.disconnectCause ?: return "sem DisconnectCause"
        val connect = call.details.connectTimeMillis
        val talk = if (connect > 0) " | tempo em ACTIVE=${System.currentTimeMillis() - connect}ms" else ""
        return "causa=${cause.code} (${causeName(cause.code)})" +
            " | rótulo='${cause.label ?: ""}'" +
            " | motivo='${cause.reason ?: ""}'" +
            " | descrição='${cause.description ?: ""}'" +
            talk
    }

    @Suppress("DEPRECATION")
    fun stateOf(call: Call): Int = call.state

    fun isIncoming(call: Call): Boolean =
        call.details.callDirection == Call.Details.DIRECTION_INCOMING

    fun numberOf(call: Call): String =
        call.details.handle?.schemeSpecificPart?.takeIf { it.isNotBlank() } ?: "(oculto)"

    fun stateName(state: Int): String = when (state) {
        Call.STATE_NEW -> "NEW"
        Call.STATE_DIALING -> "DIALING"
        Call.STATE_RINGING -> "RINGING"
        Call.STATE_HOLDING -> "HOLDING"
        Call.STATE_ACTIVE -> "ACTIVE"
        Call.STATE_DISCONNECTED -> "DISCONNECTED"
        Call.STATE_SELECT_PHONE_ACCOUNT -> "SELECT_PHONE_ACCOUNT"
        Call.STATE_CONNECTING -> "CONNECTING"
        Call.STATE_DISCONNECTING -> "DISCONNECTING"
        Call.STATE_PULLING_CALL -> "PULLING_CALL"
        12 -> "AUDIO_PROCESSING"
        13 -> "SIMULATED_RINGING"
        else -> "ESTADO_$state"
    }

    fun causeName(code: Int): String = when (code) {
        DisconnectCause.UNKNOWN -> "UNKNOWN"
        DisconnectCause.ERROR -> "ERROR"
        DisconnectCause.LOCAL -> "LOCAL"
        DisconnectCause.REMOTE -> "REMOTE"
        DisconnectCause.CANCELED -> "CANCELED"
        DisconnectCause.MISSED -> "MISSED"
        DisconnectCause.REJECTED -> "REJECTED"
        DisconnectCause.BUSY -> "BUSY"
        DisconnectCause.RESTRICTED -> "RESTRICTED"
        DisconnectCause.OTHER -> "OTHER"
        DisconnectCause.CONNECTION_MANAGER_NOT_SUPPORTED -> "CONNECTION_MANAGER_NOT_SUPPORTED"
        DisconnectCause.ANSWERED_ELSEWHERE -> "ANSWERED_ELSEWHERE"
        DisconnectCause.CALL_PULLED -> "CALL_PULLED"
        else -> "CODIGO_$code"
    }
}
