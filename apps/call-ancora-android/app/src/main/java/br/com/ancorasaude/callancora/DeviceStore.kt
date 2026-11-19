package br.com.ancorasaude.callancora

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/** Conexão com o AncoraHub guardada de forma criptografada (token do dispositivo). */
data class CrmConnection(val origin: String, val token: String, val brokerFirstName: String, val sessionId: String)

object DeviceStore {
    private const val FILE = "call_ancora_crm"
    private var cached: SharedPreferences? = null

    private fun prefs(context: Context): SharedPreferences? {
        cached?.let { return it }
        return try {
            val alias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            EncryptedSharedPreferences.create(
                FILE,
                alias,
                context.applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            ).also { cached = it }
        } catch (e: Exception) {
            // Keystore indisponível: não guarda o token (fica só em memória nesta execução).
            null
        }
    }

    fun load(context: Context): CrmConnection? {
        val p = prefs(context) ?: return null
        val origin = p.getString("origin", null) ?: return null
        val token = p.getString("token", null) ?: return null
        return CrmConnection(origin, token, p.getString("broker", "").orEmpty(), p.getString("session", "").orEmpty())
    }

    fun save(context: Context, connection: CrmConnection) {
        prefs(context)?.edit()
            ?.putString("origin", connection.origin)
            ?.putString("token", connection.token)
            ?.putString("broker", connection.brokerFirstName)
            ?.putString("session", connection.sessionId)
            ?.apply()
    }

    fun clear(context: Context) {
        prefs(context)?.edit()?.clear()?.apply()
    }
}
