package br.com.ancorasaude.callancora

/**
 * Regras de desligamento automático, só por TEMPO (o app não tem acesso ao áudio da
 * ligação desde o Android 10). São estimativas: "provável caixa postal", "não atendeu".
 * Código puro (sem Android) para testar no JVM.
 */
data class HangupConfig(
    /** "Desligar sozinho caixa postal e não atendidas". */
    val enabled: Boolean = true,
    /** Sem ACTIVE depois de tanto tempo discando: desliga como "Não atendeu". */
    val ringTimeoutSec: Int = DEFAULT_RING_TIMEOUT,
    /** ACTIVE chegou rápido demais (sem tempo de tocar): provável caixa postal/mensagem da operadora. */
    val quickActiveSec: Int = DEFAULT_QUICK_ACTIVE,
    /** ACTIVE chegou depois disto: a operadora provavelmente mandou para a caixa postal. */
    val voicemailAfterSec: Int = DEFAULT_VOICEMAIL_AFTER,
) {
    companion object {
        const val DEFAULT_RING_TIMEOUT = 22
        const val DEFAULT_QUICK_ACTIVE = 4
        const val DEFAULT_VOICEMAIL_AFTER = 25
        val RING_TIMEOUT_RANGE = 15..40
        val QUICK_ACTIVE_RANGE = 2..8
        val VOICEMAIL_AFTER_RANGE = 15..60
    }

    /** Mantém cada valor dentro da faixa permitida. */
    fun clamped() = copy(
        ringTimeoutSec = ringTimeoutSec.coerceIn(RING_TIMEOUT_RANGE),
        quickActiveSec = quickActiveSec.coerceIn(QUICK_ACTIVE_RANGE),
        voicemailAfterSec = voicemailAfterSec.coerceIn(VOICEMAIL_AFTER_RANGE),
    )

    fun describe() = "toque=${ringTimeoutSec}s, rápido<${quickActiveSec}s, tardio>=${voicemailAfterSec}s"
}

/** Resultado que o app decide sozinho; [api] é o valor mandado ao CRM. */
enum class AutoOutcome(val api: String, val label: String) {
    NO_ANSWER("no_answer", "Não atendeu"),
    VOICEMAIL("voicemail", "Provável caixa postal"),
}

/**
 * Decisão de desligar. [rule]: ring_timeout, quick_active, late_active, manual (botão no
 * celular) ou manual_web (botão na web). [dialToActiveMs]: DISCANDO até ACTIVE, se houve.
 */
data class HangupDecision(val outcome: AutoOutcome, val rule: String, val dialToActiveMs: Long?) {
    val isManual: Boolean get() = rule.startsWith("manual")

    /** Texto para a tela (sempre deixando claro que é estimativa quando automático). */
    fun humanLabel(): String = when (rule) {
        "ring_timeout" -> "Não atendeu (tempo de toque esgotado, o app desligou)"
        "quick_active" -> "Provável caixa postal (atendeu rápido demais, o app desligou)"
        "late_active" -> "Provável caixa postal (atendeu depois do tempo de toque, o app desligou)"
        "manual", "manual_web" -> "Caixa postal (desligada por você)"
        else -> outcome.label
    }
}

object HangupRules {

    /** Chamado quando a ligação fica ACTIVE. */
    fun onActive(dialToActiveMs: Long, config: HangupConfig): HangupDecision? {
        if (!config.enabled) return null
        val cfg = config.clamped()
        if (dialToActiveMs < cfg.quickActiveSec * 1_000L) {
            return HangupDecision(AutoOutcome.VOICEMAIL, "quick_active", dialToActiveMs)
        }
        if (dialToActiveMs >= cfg.voicemailAfterSec * 1_000L) {
            return HangupDecision(AutoOutcome.VOICEMAIL, "late_active", dialToActiveMs)
        }
        return null
    }

    /** Chamado periodicamente enquanto a ligação ainda não ficou ACTIVE. */
    fun onStillDialing(elapsedMs: Long, config: HangupConfig): HangupDecision? {
        if (!config.enabled) return null
        val cfg = config.clamped()
        return if (elapsedMs >= cfg.ringTimeoutSec * 1_000L) {
            HangupDecision(AutoOutcome.NO_ANSWER, "ring_timeout", null)
        } else {
            null
        }
    }

    /** Botão "Caixa postal" (no celular ou na web). */
    fun manualVoicemail(rule: String, dialToActiveMs: Long?) =
        HangupDecision(AutoOutcome.VOICEMAIL, rule, dialToActiveMs)
}
