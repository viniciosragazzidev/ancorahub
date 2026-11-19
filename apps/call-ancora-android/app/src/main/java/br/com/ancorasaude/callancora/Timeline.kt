package br.com.ancorasaude.callancora

import android.telecom.Call
import androidx.annotation.ColorRes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Uma linha da linha do tempo amigável. */
data class TimelineItem(
    val title: String,
    val subtitle: String,
    @ColorRes val dotColor: Int,
    val sinceDial: String,
)

/**
 * Transforma o registro técnico em uma linha do tempo legível.
 * Não altera o registro: Copiar/Enviar continuam mandando o texto bruto.
 */
object Timeline {
    private val timeFmt = SimpleDateFormat("HH:mm:ss", Locale("pt", "BR"))

    /** Passos da discagem automática, em português. */
    private val autoTitles = mapOf(
        AutoDialer.EVENT_AUTO_NEXT to "Próxima automática",
        AutoDialer.EVENT_PAUSED to "Fila pausada",
        AutoDialer.EVENT_SKIPPED to "Número pulado",
        AutoDialer.EVENT_RESUMED to "Fila retomada",
        AutoDialer.EVENT_LIMIT to "Limite por hora atingido",
        AutoDialer.EVENT_FINISHED to "Fila concluída",
        AutoDialer.EVENT_SESSION_ENDED to "Sessão encerrada",
    )

    /** Quantas ligações há no registro (pedidas pelo app ou recebidas). */
    fun callCount(entries: List<LogEntry>): Int = entries.count {
        it.event == CallBus.EVENT_DIAL_REQUEST ||
            (it.event.startsWith(CallBus.EVENT_ADDED_PREFIX) && it.incoming)
    }

    /** Itens da ligação mais recente. */
    fun lastCall(entries: List<LogEntry>): List<TimelineItem> {
        if (entries.isEmpty()) return emptyList()
        val dial = entries.indexOfLast { it.event == CallBus.EVENT_DIAL_REQUEST }
        val added = entries.indexOfLast { it.event.startsWith(CallBus.EVENT_ADDED_PREFIX) }
        val start = when {
            dial < 0 && added < 0 -> maxOf(0, entries.size - 6)
            dial < 0 -> added
            // Depois do último pedido chegou mais de uma ligação: mostra só a última.
            added > dial && entries.subList(dial + 1, added)
                .any { it.event.startsWith(CallBus.EVENT_ADDED_PREFIX) } -> added
            else -> dial
        }
        return toItems(entries.subList(start, entries.size))
    }

    /** Converte entradas em itens, sem repetir o mesmo estado em sequência. */
    fun toItems(entries: List<LogEntry>): List<TimelineItem> {
        val items = mutableListOf<TimelineItem>()
        var previousState: Int? = null
        for (e in entries) {
            if (e.event == CallBus.EVENT_REMOVED) continue
            val state = e.state
            if (state != null && state == previousState) continue
            items += toItem(e)
            if (state != null) previousState = state
        }
        return items
    }

    private fun toItem(e: LogEntry): TimelineItem {
        val since = Labels.sinceDial(e.sinceDialMs)
        val state = e.state
        return when {
            e.event == CallBus.EVENT_DIAL_REQUEST -> TimelineItem(
                title = "Pedido de ligação",
                subtitle = listOfNotNull(e.scenario, timeFmt.format(Date(e.wallClockMs))).joinToString(" · "),
                dotColor = R.color.dot_neutral,
                sinceDial = since,
            )
            e.event == CallBus.EVENT_NOTE -> TimelineItem(
                title = "Aviso",
                subtitle = e.detail.orEmpty(),
                dotColor = R.color.ancora_gold,
                sinceDial = "",
            )
            e.event in autoTitles -> TimelineItem(
                title = autoTitles.getValue(e.event),
                subtitle = listOfNotNull(
                    e.number.takeIf { it != "-" }?.let { Phone.display(it) },
                    e.detail,
                ).joinToString(" · "),
                dotColor = if (e.event == AutoDialer.EVENT_AUTO_NEXT) R.color.ancora_blue else R.color.ancora_gold,
                sinceDial = "",
            )
            state == Call.STATE_DISCONNECTED -> {
                val cause = e.causeCode?.let { CallBus.causeName(it) } ?: "sem causa"
                val talk = e.activeMs?.let { " · ${Math.round(it / 1000.0)} s em ligação" } ?: ""
                TimelineItem(
                    title = Labels.friendlyDisconnect(e.causeCode, e.causeReason, e.causeLabel, e.incoming),
                    subtitle = cause + talk,
                    dotColor = R.color.hangup_red,
                    sinceDial = since,
                )
            }
            state != null -> TimelineItem(
                title = Labels.timelineState(state, e.incoming),
                subtitle = CallBus.stateName(state),
                dotColor = Labels.timelineDot(state, e.incoming),
                sinceDial = since,
            )
            else -> TimelineItem(
                title = e.event,
                subtitle = e.detail.orEmpty(),
                dotColor = R.color.dot_neutral,
                sinceDial = since,
            )
        }
    }
}
