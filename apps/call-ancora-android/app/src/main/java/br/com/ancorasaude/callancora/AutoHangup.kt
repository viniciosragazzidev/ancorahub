package br.com.ancorasaude.callancora

import android.content.Context
import android.os.SystemClock
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Ajustes "Regras de desligamento", guardados no celular. */
object HangupSettings {
    private const val PREFS = "call_ancora"
    private val _config = MutableStateFlow(HangupConfig())
    val config: StateFlow<HangupConfig> = _config.asStateFlow()
    private var loaded = false

    fun load(context: Context) {
        if (loaded) return
        loaded = true
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        _config.value = HangupConfig(
            enabled = p.getBoolean("hangup_enabled", true),
            ringTimeoutSec = p.getInt("hangup_ring", HangupConfig.DEFAULT_RING_TIMEOUT),
            quickActiveSec = p.getInt("hangup_quick", HangupConfig.DEFAULT_QUICK_ACTIVE),
            voicemailAfterSec = p.getInt("hangup_late", HangupConfig.DEFAULT_VOICEMAIL_AFTER),
        ).clamped()
    }

    fun update(context: Context, config: HangupConfig) {
        val value = config.clamped()
        _config.value = value
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("hangup_enabled", value.enabled)
            .putInt("hangup_ring", value.ringTimeoutSec)
            .putInt("hangup_quick", value.quickActiveSec)
            .putInt("hangup_late", value.voicemailAfterSec)
            .apply()
    }
}

/**
 * Aplica as [HangupRules] na ligação feita pelo app: mede DISCANDO → ACTIVE, desliga sozinho
 * quando a regra manda e guarda a decisão para o registro, a fila local e o CRM.
 */
object AutoHangup {
    data class Result(val decision: HangupDecision?, val dialToActiveMs: Long?)

    private val scope = MainScope()
    private var watch: Job? = null
    private var dialingAt: Long? = null
    private var dialToActiveMs: Long? = null
    private var decision: HangupDecision? = null
    private var number: String = "-"
    private var tracking = false

    /** Ligação feita pelo app começou (DISCANDO). */
    internal fun onOutgoingStarted(callNumber: String) {
        watch?.cancel()
        tracking = true
        number = callNumber
        dialingAt = SystemClock.elapsedRealtime()
        dialToActiveMs = null
        decision = null
        watch = scope.launch {
            while (tracking && dialToActiveMs == null && decision == null) {
                delay(500)
                val start = dialingAt ?: break
                val elapsed = SystemClock.elapsedRealtime() - start
                HangupRules.onStillDialing(elapsed, HangupSettings.config.value)?.let { fire(it, elapsed) }
            }
        }
    }

    /** A ligação ficou ACTIVE. */
    internal fun onActive() {
        if (!tracking || dialToActiveMs != null) return
        val start = dialingAt ?: return
        val ms = SystemClock.elapsedRealtime() - start
        dialToActiveMs = ms
        watch?.cancel()
        HangupRules.onActive(ms, HangupSettings.config.value)?.let { fire(it, ms) }
    }

    /** Botão "Caixa postal" (rule = "manual" no celular, "manual_web" quando veio da web). */
    fun manualVoicemail(rule: String) {
        if (!tracking || decision != null) return
        fire(HangupRules.manualVoicemail(rule, dialToActiveMs), dialToActiveMs ?: elapsed())
    }

    /** Há uma ligação do app sendo acompanhada (mostra o botão Caixa postal). */
    val isTracking: Boolean get() = tracking

    /** Ligação encerrada: devolve a decisão (se houve) e para de acompanhar. */
    internal fun take(): Result {
        val result = Result(decision, dialToActiveMs)
        watch?.cancel()
        tracking = false
        dialingAt = null
        decision = null
        dialToActiveMs = null
        return result
    }

    private fun elapsed(): Long = dialingAt?.let { SystemClock.elapsedRealtime() - it } ?: 0L

    private fun fire(d: HangupDecision, measuredMs: Long) {
        if (decision != null) return
        decision = d
        CallBus.logEvent(
            "AUTO_DESLIGAR",
            number,
            "regra=${d.rule} | resultado=${d.outcome.api} | discando→ativo=${d.dialToActiveMs?.let { "${it}ms" } ?: "-"}" +
                " | medido=${measuredMs}ms | ${HangupSettings.config.value.describe()}",
        )
        CallBus.hangup()
    }
}
