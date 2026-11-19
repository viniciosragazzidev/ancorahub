package br.com.ancorasaude.callancora

import android.telecom.Call
import android.telecom.DisconnectCause
import androidx.annotation.ColorRes
import java.util.Locale

/** Textos em português simples e cores para estados e causas do Android. */
object Labels {
    private val ptBr = Locale("pt", "BR")

    /** Rótulo da tela de chamada. */
    fun callState(state: Int, incoming: Boolean): String = when (state) {
        Call.STATE_NEW, Call.STATE_CONNECTING -> "Conectando…"
        Call.STATE_DIALING -> "Discando…"
        Call.STATE_RINGING -> if (incoming) "Chamando você" else "Chamando…"
        Call.STATE_HOLDING -> "Em espera"
        Call.STATE_ACTIVE -> "Em ligação"
        Call.STATE_DISCONNECTING -> "Encerrando…"
        Call.STATE_DISCONNECTED -> "Ligação encerrada"
        Call.STATE_SELECT_PHONE_ACCOUNT -> "Escolha o chip"
        else -> CallBus.stateName(state)
    }

    /** Cor da bolinha de estado na tela de chamada. */
    @ColorRes
    fun callStateDot(state: Int, incoming: Boolean): Int = when (state) {
        Call.STATE_ACTIVE -> R.color.ancora_green
        Call.STATE_DISCONNECTED, Call.STATE_DISCONNECTING -> R.color.ended_dot
        Call.STATE_RINGING -> if (incoming) R.color.ancora_gold else R.color.ancora_lime
        Call.STATE_HOLDING -> R.color.ancora_gold
        else -> R.color.ancora_lime
    }

    /** Título da linha do tempo para um estado (exceto DISCONNECTED, ver [disconnectTitle]). */
    fun timelineState(state: Int, incoming: Boolean): String = when (state) {
        Call.STATE_NEW -> "Preparando"
        Call.STATE_CONNECTING -> "Conectando"
        Call.STATE_DIALING -> "Discando"
        Call.STATE_RINGING -> if (incoming) "Ligação recebida" else "Chamando"
        Call.STATE_HOLDING -> "Em espera"
        Call.STATE_ACTIVE -> "Em ligação"
        Call.STATE_DISCONNECTING -> "Encerrando"
        Call.STATE_SELECT_PHONE_ACCOUNT -> "Escolha do chip"
        else -> CallBus.stateName(state)
    }

    @ColorRes
    fun timelineDot(state: Int, incoming: Boolean): Int = when (state) {
        Call.STATE_DIALING, Call.STATE_CONNECTING -> R.color.ancora_blue
        Call.STATE_RINGING -> if (incoming) R.color.ancora_gold else R.color.ancora_blue
        Call.STATE_ACTIVE -> R.color.ancora_green
        Call.STATE_DISCONNECTED -> R.color.hangup_red
        Call.STATE_HOLDING -> R.color.ancora_gold
        else -> R.color.dot_neutral
    }

    /** Título da linha do tempo quando a ligação caiu. */
    fun disconnectTitle(code: Int?, incoming: Boolean): String = when (code) {
        DisconnectCause.LOCAL -> "Encerrada por você"
        DisconnectCause.REMOTE -> "Encerrada pelo outro lado"
        DisconnectCause.BUSY -> "Número ocupado"
        DisconnectCause.MISSED -> if (incoming) "Não atendida" else "Sem resposta"
        DisconnectCause.REJECTED -> "Recusada"
        DisconnectCause.CANCELED -> "Cancelada"
        DisconnectCause.ERROR -> "Falha na ligação"
        DisconnectCause.RESTRICTED -> "Ligação bloqueada"
        DisconnectCause.ANSWERED_ELSEWHERE -> "Atendida em outro aparelho"
        DisconnectCause.CALL_PULLED -> "Transferida"
        DisconnectCause.OTHER -> "Encerrada (outro motivo)"
        else -> "Encerrada"
    }

    /** "Motivo" no resumo da tela de chamada. */
    fun disconnectReason(code: Int?, incoming: Boolean): String = when (code) {
        DisconnectCause.LOCAL -> "Você desligou"
        DisconnectCause.REMOTE -> "O outro lado desligou"
        DisconnectCause.BUSY -> "Número ocupado"
        DisconnectCause.MISSED -> if (incoming) "Não atendida" else "Sem resposta"
        DisconnectCause.REJECTED -> "Recusada"
        DisconnectCause.CANCELED -> "Cancelada"
        DisconnectCause.ERROR -> "Falha na ligação"
        DisconnectCause.RESTRICTED -> "Ligação bloqueada"
        DisconnectCause.ANSWERED_ELSEWHERE -> "Atendida em outro aparelho"
        DisconnectCause.CALL_PULLED -> "Transferida"
        DisconnectCause.OTHER -> "Outro motivo"
        null -> "Desconhecido"
        else -> "Desconhecido"
    }

    /** 8300 -> "8,3 s". */
    fun seconds(ms: Long): String = String.format(ptBr, "%.1f s", ms / 1000.0)

    /** 32000 -> "00:32". */
    fun clock(ms: Long): String {
        val total = (ms / 1000).coerceAtLeast(0)
        return String.format(ptBr, "%02d:%02d", total / 60, total % 60)
    }

    /** Tempo desde o pedido de ligação na linha do tempo: "0 ms" ou "+0,7 s". */
    fun sinceDial(ms: Long?): String = when {
        ms == null -> ""
        ms <= 0L -> "0 ms"
        else -> "+" + seconds(ms)
    }
}
