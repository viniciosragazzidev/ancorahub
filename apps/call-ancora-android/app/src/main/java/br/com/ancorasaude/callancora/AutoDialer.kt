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

/**
 * Sessão de ligações com discagem automática: liga para o primeiro número e, quando a
 * ligação cai, conta 3 s e disca o próximo sem toque. Tudo roda na thread principal.
 *
 * Cada passo automático vai para o registro técnico (AUTO_PROXIMA, PAUSADA, PULADA,
 * RETOMADA, LIMITE_ATINGIDO, FILA_CONCLUIDA, SESSAO_ENCERRADA) para medir os intervalos.
 */
object AutoDialer {
    const val COUNTDOWN_SECONDS = 3
    /** Intervalo mínimo entre dois pedidos de ligação, para proteger o chip. */
    const val MIN_INTERVAL_MS = 3_000L
    /** Teto de ligações por hora, para o chip não ser bloqueado pela operadora. */
    const val MAX_CALLS_PER_HOUR = 60
    /** Se a ligação pedida não aparecer em tanto tempo, a fila pausa. */
    private const val START_TIMEOUT_MS = 15_000L
    private const val HOUR_MS = 3_600_000L

    const val EVENT_AUTO_NEXT = "AUTO_PROXIMA"
    const val EVENT_PAUSED = "PAUSADA"
    const val EVENT_SKIPPED = "PULADA"
    const val EVENT_RESUMED = "RETOMADA"
    const val EVENT_LIMIT = "LIMITE_ATINGIDO"
    const val EVENT_FINISHED = "FILA_CONCLUIDA"
    const val EVENT_SESSION_ENDED = "SESSAO_ENCERRADA"

    data class Stats(
        val total: Int = 0,
        val answered: Int = 0,
        val talkMsTotal: Long = 0,
    ) {
        val talkMsAverage: Long get() = if (answered == 0) 0 else talkMsTotal / answered
    }

    sealed interface State {
        data object Idle : State
        data class Calling(val item: QueueNumber) : State
        data class Countdown(val next: QueueNumber, val secondsLeft: Int) : State
        data class Paused(val reason: String, val next: QueueNumber?) : State
        data class Finished(val stats: Stats, val endedByUser: Boolean) : State
    }

    /** Fonte dos números. Etapa 2 troca por CrmQueueSource. */
    var source: NumberSource = LocalQueueSource

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private val _stats = MutableStateFlow(Stats())
    val stats: StateFlow<Stats> = _stats.asStateFlow()

    private val _autoEnabled = MutableStateFlow(true)
    val autoEnabled: StateFlow<Boolean> = _autoEnabled.asStateFlow()

    private val scope = MainScope()
    private var job: Job? = null
    private var watchdog: Job? = null
    private var appContext: Context? = null
    private var sessionScenario = ""
    private var lastDialAt: Long? = null
    private var lastEndedAt: Long? = null
    private var callStarted = false
    /** Uma ligação da sessão foi discada e ainda não caiu. */
    private var awaitingCallEnd = false
    private var currentItem: QueueNumber? = null
    /** A fila pausou sozinha por falta de sinal: retoma sozinha quando o sinal voltar. */
    private var pausedForSignal = false
    private val dialTimes = ArrayDeque<Long>()

    val isSessionActive: Boolean
        get() = _state.value.let { it is State.Calling || it is State.Countdown || it is State.Paused }

    fun setAutoEnabled(enabled: Boolean) {
        _autoEnabled.value = enabled
    }

    /** Liga para o primeiro número da fila. Devolve a mensagem de erro, se houver. */
    fun start(context: Context, scenario: String): String? {
        if (isSessionActive) return "Já existe uma sessão em andamento."
        if (source.remaining() == 0) return "A fila está vazia."
        if (!Readiness.allReady(context)) return "O celular ainda não está pronto."
        appContext = context.applicationContext
        sessionScenario = scenario
        _stats.value = Stats()
        lastEndedAt = null
        launchJob {
            val first = source.next()
            if (first == null) {
                finish(endedByUser = false)
            } else {
                dial(first, auto = false)
            }
        }
        return null
    }

    // ---------- Eventos do CallBus ----------

    /** Uma ligação feita caiu (qualquer causa). */
    internal fun onOutgoingEnded(answered: Boolean, talkMs: Long?) {
        if (!awaitingCallEnd) return
        awaitingCallEnd = false
        watchdog?.cancel()
        lastEndedAt = SystemClock.elapsedRealtime()
        val s = _stats.value
        _stats.value = if (answered) {
            s.copy(answered = s.answered + 1, talkMsTotal = s.talkMsTotal + (talkMs ?: 0))
        } else {
            s
        }
        // Pausada durante a ligação: só registra; a fila segue quando a pessoa tocar em Continuar.
        if (_state.value !is State.Calling) return
        launchJob {
            val next = source.next()
            when {
                next == null -> finish(endedByUser = false)
                !_autoEnabled.value -> pause("Discagem automática desligada. Toque em Continuar.", next)
                else -> countdownThenDial(next)
            }
        }
    }

    /** Uma ligação feita foi adicionada pelo Android (a discagem começou de fato). */
    internal fun onOutgoingAdded() {
        if (_state.value is State.Calling) {
            callStarted = true
            watchdog?.cancel()
        }
    }

    /** O sinal da operadora mudou (vem do SignalMonitor). */
    internal fun onSignalChanged(inService: Boolean) {
        val st = _state.value
        if (!inService) {
            if (st is State.Countdown) pauseForSignal(st.next)
        } else if (st is State.Paused && pausedForSignal) {
            resume()
        }
    }

    private fun pauseForSignal(next: QueueNumber?) {
        pause(SignalMonitor.status.value.message + ". A fila volta sozinha quando o sinal voltar.", next)
        pausedForSignal = true
    }

    /** Chegou uma ligação: não disca por cima dela. */
    internal fun onIncomingCall() {
        if (_state.value is State.Countdown) {
            val next = (_state.value as State.Countdown).next
            pause("Chegou uma ligação.", next)
        }
    }

    // ---------- Ações do usuário ----------

    fun pauseByUser() {
        when (val st = _state.value) {
            is State.Countdown -> pause("Pausada por você.", st.next)
            is State.Calling -> pause("Pausada por você. A ligação atual continua.", null)
            else -> Unit
        }
    }

    fun resume() {
        val st = _state.value as? State.Paused ?: return
        pausedForSignal = false
        CallBus.logEvent(EVENT_RESUMED, st.next?.number ?: "-", null)
        val ongoing = currentItem
        if (awaitingCallEnd && ongoing != null) {
            // Pausou durante uma ligação: ao terminar ela, a fila segue sozinha.
            st.next?.let { item -> scope.launch { source.returnToFront(item) } }
            _state.value = State.Calling(ongoing)
            return
        }
        launchJob {
            val next = st.next ?: source.next()
            if (next == null) finish(endedByUser = false) else countdownThenDial(next)
        }
    }

    /** Pula o próximo número da contagem (ou da pausa). */
    fun skip() {
        val skipped = when (val st = _state.value) {
            is State.Countdown -> st.next
            is State.Paused -> st.next
            else -> null
        } ?: return
        CallBus.logEvent(EVENT_SKIPPED, skipped.number, null)
        launchJob {
            val next = source.next()
            if (next == null) finish(endedByUser = false) else countdownThenDial(next)
        }
    }

    /** "Encerrar sessão": desliga a ligação atual e não disca mais nada. */
    fun endSession() {
        if (!isSessionActive) return
        val pending = when (val st = _state.value) {
            is State.Countdown -> st.next
            is State.Paused -> st.next
            else -> null
        }
        job?.cancel()
        watchdog?.cancel()
        awaitingCallEnd = false
        CallBus.logEvent(EVENT_SESSION_ENDED, "-", "encerrada por você")
        if (CallBus.hasLiveCall()) CallBus.hangup()
        pending?.let { item -> scope.launch { source.returnToFront(item) } }
        _state.value = State.Finished(_stats.value, endedByUser = true)
    }

    /** Fecha o resumo e volta ao começo. */
    fun dismiss() {
        if (_state.value is State.Finished) _state.value = State.Idle
    }

    // ---------- Interno ----------

    private suspend fun countdownThenDial(next: QueueNumber) {
        for (s in COUNTDOWN_SECONDS downTo 1) {
            _state.value = State.Countdown(next, s)
            delay(1_000)
        }
        dial(next, auto = true)
    }

    private suspend fun dial(item: QueueNumber, auto: Boolean) {
        val context = appContext ?: return pause("Sessão perdida. Toque em Continuar.", item)

        if (!SignalMonitor.inService) {
            return pauseForSignal(item)
        }
        if (CallPlacer.phoneBusy(context)) {
            return pause("Há outra ligação em andamento.", item)
        }
        if (!Readiness.allReady(context)) {
            return pause("O celular deixou de estar pronto (discador padrão ou permissão).", item)
        }

        val now = SystemClock.elapsedRealtime()
        while (dialTimes.isNotEmpty() && now - dialTimes.first() > HOUR_MS) dialTimes.removeFirst()
        if (dialTimes.size >= MAX_CALLS_PER_HOUR) {
            CallBus.logEvent(EVENT_LIMIT, item.number, "limite=$MAX_CALLS_PER_HOUR por hora")
            return pause("Limite de $MAX_CALLS_PER_HOUR ligações por hora atingido, para proteger o chip.", item)
        }
        lastDialAt?.let { last ->
            val wait = MIN_INTERVAL_MS - (now - last)
            if (wait > 0) delay(wait)
        }

        if (auto) {
            val gap = lastEndedAt?.let { SystemClock.elapsedRealtime() - it }
            val detail = buildString {
                append("intervalo desde o fim da anterior=")
                append(gap?.let { "${it}ms" } ?: "-")
                append(" | restantes=")
                append(source.remaining()?.toString() ?: "?")
            }
            CallBus.logEvent(EVENT_AUTO_NEXT, item.number, detail)
        }

        _state.value = State.Calling(item)
        currentItem = item
        callStarted = false
        val error = CallPlacer.place(context, item.number, item.scenario ?: sessionScenario)
        if (error != null) {
            return pause(error, item)
        }
        awaitingCallEnd = true
        lastDialAt = SystemClock.elapsedRealtime()
        dialTimes.addLast(lastDialAt!!)
        _stats.value = _stats.value.copy(total = _stats.value.total + 1)

        watchdog?.cancel()
        watchdog = scope.launch {
            delay(START_TIMEOUT_MS)
            if (!callStarted && _state.value is State.Calling) {
                awaitingCallEnd = false
                pause("A ligação não começou. Confira o sinal e toque em Continuar.", null)
            }
        }
    }

    /**
     * Para a fila. Quando chamada de dentro do próprio trabalho da sessão, é sempre o último
     * passo dele, então cancelar o trabalho atual não interrompe nada pela metade.
     */
    private fun pause(reason: String, next: QueueNumber?) {
        job?.cancel()
        pausedForSignal = false
        CallBus.logEvent(EVENT_PAUSED, next?.number ?: "-", reason)
        _state.value = State.Paused(reason, next)
    }

    private fun finish(endedByUser: Boolean) {
        val s = _stats.value
        CallBus.logEvent(
            EVENT_FINISHED,
            "-",
            "total=${s.total} | atendidas=${s.answered} | tempo em ligação=${s.talkMsTotal}ms",
        )
        _state.value = State.Finished(s, endedByUser)
    }

    /** Roda [block] como o trabalho atual da sessão, cancelando o anterior. */
    private fun launchJob(block: suspend () -> Unit) {
        job?.cancel()
        job = scope.launch { block() }
    }
}
