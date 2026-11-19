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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

/**
 * Sessão pareada com o AncoraHub: lê o estado a cada 2 s, disca o contato atual quando
 * ele é discável e está pronto, manda cada evento da ligação para o servidor e espera a
 * classificação na web. O avanço da fila e a discagem automática vêm do servidor; aqui
 * valem as proteções locais (sinal, celular pronto, sem ligação por cima, 3 s, 60/h).
 */
object CrmSession {
    /** 1 s com ligação ou contagem em andamento; 2 s parado. */
    private const val POLL_ACTIVE_MS = 1_000L
    private const val POLL_IDLE_MS = 2_000L
    private const val START_TIMEOUT_MS = 15_000L
    private const val HOUR_MS = 3_600_000L

    data class Ui(
        val connection: CrmConnection? = null,
        val state: CrmState? = null,
        /** O corretor tocou em Começar neste celular. */
        val started: Boolean = false,
        /** Há uma ligação desta sessão em andamento. */
        val calling: Boolean = false,
        val message: String? = null,
    )

    private val _ui = MutableStateFlow(Ui())
    val ui: StateFlow<Ui> = _ui.asStateFlow()

    /** A tela principal está visível (sondagem mais frequente). */
    @Volatile var foreground = false

    private val scope = MainScope()
    private val reportLock = Mutex()
    private var pollJob: Job? = null
    private var watchdog: Job? = null
    private var appContext: Context? = null
    private var source: CrmQueueSource? = null
    private var api: CrmApi? = null

    private var manualContactId: String? = null
    private var awaitingContactId: String? = null
    private var callStarted = false
    /** O pedido de desligar da web já foi atendido nesta ligação. */
    private var hangupRequestHandled = false
    /** Versão do estado conferida logo antes de discar (vai no evento "dialing"). */
    private var dialVersion: Long? = null
    private var dialAt: Long? = null
    private var activeAt: Long? = null
    private var lastDialAt: Long? = null
    private val dialTimes = ArrayDeque<Long>()

    val isConnected: Boolean get() = _ui.value.connection != null

    /** Recupera a conexão guardada (ao abrir o app). */
    fun restore(context: Context) {
        appContext = context.applicationContext
        if (isConnected) return
        DeviceStore.load(context)?.let { connect(it) }
    }

    /** Lê o QR e pareia. Devolve a mensagem de erro, ou null se conectou. */
    suspend fun pairFromQr(context: Context, text: String): String? {
        appContext = context.applicationContext
        val qr = CrmApi.parseQr(text)
            ?: return "Este QR não é do Call Âncora, ou vem de um endereço não permitido."
        return try {
            val result = CrmApi(qr.origin, null).pair(qr.ticket)
            val connection = CrmConnection(qr.origin, result.deviceToken, result.brokerFirstName, result.sessionId)
            DeviceStore.save(context, connection)
            connect(connection)
            _ui.value = _ui.value.copy(state = result.state)
            CallBus.logEvent("CRM_CONECTADO", "-", "sessão=${result.sessionId.take(8)} | origem=${qr.origin}")
            null
        } catch (e: CrmException) {
            e.message
        }
    }

    fun disconnect(context: Context) {
        pollJob?.cancel()
        watchdog?.cancel()
        DeviceStore.clear(context)
        source = null
        api = null
        resetCallTracking()
        manualContactId = null
        _ui.value = Ui()
        CallBus.logEvent("CRM_DESCONECTADO", "-", null)
    }

    /** "Começar ligações" / "Ligar para o próximo" / "Tentar de novo". */
    fun callCurrent() {
        val state = _ui.value.state ?: return
        val current = state.current ?: return
        manualContactId = current.id
        if (awaitingContactId == null) source?.allowRetry()
        _ui.value = _ui.value.copy(started = true, message = null)
        scope.launch { tick() }
    }

    fun togglePause() {
        val paused = _ui.value.state?.paused == true
        control(if (paused) "resume" else "pause")
    }

    fun skip() = control("skip")

    /**
     * Encerrar sessão no celular: desliga a ligação atual e encerra a sessão no servidor
     * (a web também encerra). O token cai e o app volta para "Conectar".
     */
    fun endSession() {
        manualContactId = null
        if (awaitingContactId != null && CallBus.hasLiveCall()) CallBus.hangup()
        CallBus.logEvent("CRM_SESSAO_ENCERRADA", "-", "pelo celular")
        val client = api
        scope.launch {
            try {
                client?.control("end")
            } catch (e: CrmException) {
                // Sessão já encerrada ou sem rede: encerra aqui de qualquer jeito.
            }
            sessionEnded("Sessão encerrada.")
        }
    }

    // ---------- Ganchos do CallBus ----------

    internal fun onOutgoingAdded() {
        val contactId = awaitingContactId ?: return
        callStarted = true
        watchdog?.cancel()
        _ui.value = _ui.value.copy(calling = true)
        report(
            JSONObject().put("contactId", contactId).put("event", "dialing").put("at", System.currentTimeMillis())
                .put("version", dialVersion ?: JSONObject.NULL),
        )
    }

    internal fun onOutgoingActive() {
        val contactId = awaitingContactId ?: return
        if (activeAt == null) activeAt = SystemClock.elapsedRealtime()
        report(JSONObject().put("contactId", contactId).put("event", "active").put("at", System.currentTimeMillis()))
    }

    internal fun onOutgoingEnded(causeCode: Int?, causeLabel: String, auto: AutoHangup.Result?) {
        val contactId = awaitingContactId ?: return
        val now = SystemClock.elapsedRealtime()
        val body = JSONObject()
            .put("contactId", contactId)
            .put("event", "disconnected")
            .put("at", System.currentTimeMillis())
            .put("causeCode", causeCode ?: JSONObject.NULL)
            .put("causeLabel", causeLabel)
            .put("timeToActiveMs", activeAt?.let { a -> dialAt?.let { a - it } } ?: JSONObject.NULL)
            .put("talkMs", activeAt?.let { now - it } ?: JSONObject.NULL)
            .put("autoOutcome", auto?.decision?.outcome?.api ?: JSONObject.NULL)
            .put("rule", auto?.decision?.rule ?: JSONObject.NULL)
            .put("dialToActiveMs", auto?.dialToActiveMs ?: JSONObject.NULL)
        hangupRequestHandled = false
        resetCallTracking()
        _ui.value = _ui.value.copy(calling = false)
        report(body)
    }

    // ---------- Interno ----------

    private fun connect(connection: CrmConnection) {
        val client = CrmApi(connection.origin, connection.token)
        api = client
        source = CrmQueueSource(client)
        resetCallTracking()
        manualContactId = null
        _ui.value = Ui(connection = connection)
        pollJob?.cancel()
        pollJob = scope.launch {
            while (true) {
                tick()
                val state = _ui.value.state
                val fast = awaitingContactId != null || state?.countdownSeconds != null ||
                    state?.callStatus == "dialing" || state?.callStatus == "active"
                delay(if (fast) POLL_ACTIVE_MS else POLL_IDLE_MS)
            }
        }
    }

    private suspend fun tick() {
        val src = source ?: return
        val item = try {
            src.next()
        } catch (e: CrmException) {
            if (e.sessionEnded) {
                sessionEnded(e.message)
                return
            }
            _ui.value = _ui.value.copy(message = e.message)
            return
        }
        val state = src.latest
        _ui.value = _ui.value.copy(state = state, message = if (_ui.value.message?.startsWith("Sem conexão") == true) null else _ui.value.message)
        // Botões da web: "Caixa postal (desligar)" ou "Desligar ligação".
        val request = state?.hangupRequest
        if (request != null && awaitingContactId != null && !hangupRequestHandled && CallBus.hasLiveCall()) {
            hangupRequestHandled = true
            if (request == "voicemail") {
                AutoHangup.manualVoicemail("manual_web")
            } else {
                CallBus.logEvent("CRM_DESLIGAR_PELA_TELA", "-", null)
                CallBus.hangup()
            }
        }
        if (state == null || item == null) {
            explainIdle(state)
            return
        }
        maybeDial(state, item)
    }

    /** Mensagem quando não há o que discar agora. */
    private fun explainIdle(state: CrmState?) {
        if (state == null || awaitingContactId != null || !_ui.value.started) return
        val current = state.current
        val text = when {
            !state.callingWindowOpen -> "Fora do horário de ligações (segunda a sábado, 8h às 20h)."
            state.total == 0 -> "Ainda não há frios na sua fila. Assim que a base de frios estiver ligada, eles aparecem aqui."
            state.status == "ended" || current == null -> "Fila concluída."
            !current.dialable -> "Este contato está bloqueado para ligação. Avance a fila na tela do computador."
            state.awaitingClassification -> "Classifique a ligação na tela do computador."
            state.countdownSeconds != null -> if (state.countdownPaused) "Contagem pausada." else "Próxima ligação em ${state.countdownSeconds} s."
            else -> null
        }
        if (text != null) _ui.value = _ui.value.copy(message = text)
    }

    private suspend fun maybeDial(state: CrmState, item: QueueNumber) {
        val context = appContext ?: return
        if (awaitingContactId != null || !_ui.value.started) return
        val contactId = item.externalId ?: return
        // Dupla checagem de segurança: só disca contato marcado como discável pelo servidor.
        if (state.current?.id != contactId || state.current.dialable != true) return

        val block = when {
            state.paused -> "Sessão pausada. Toque em Continuar."
            !(state.autoDialEnabled || manualContactId == contactId) -> "Toque em Ligar para o próximo."
            !Readiness.allReady(context) -> "Libere os itens de \"Preparar o celular\"."
            !SignalMonitor.inService -> SignalMonitor.status.value.message + "."
            CallPlacer.phoneBusy(context) -> "Há outra ligação em andamento."
            else -> rateBlock()
        }
        if (block != null) {
            _ui.value = _ui.value.copy(message = block)
            return
        }

        // Conferência na hora: estado novo do servidor (não o da última leitura).
        val fresh = try {
            api?.state() ?: return
        } catch (e: CrmException) {
            if (e.sessionEnded) {
                sessionEnded(e.message)
            } else {
                _ui.value = _ui.value.copy(message = e.message)
            }
            return
        }
        _ui.value = _ui.value.copy(state = fresh)
        val abort = when {
            fresh.runState == "ended" -> "Sessão encerrada."
            fresh.runState != "running" -> if (fresh.pausedBy == "phone") "Sessão pausada no celular." else "Pausado pela tela."
            fresh.version != state.version -> "A sessão mudou na tela. Conferindo de novo…"
            fresh.current?.id != contactId || fresh.current.dialable != true || fresh.callStatus != "ready" -> "A fila mudou na tela."
            else -> null
        }
        if (abort != null) {
            CallBus.logEvent("CRM_DISCAGEM_CANCELADA", item.number, "$abort | versão=${state.version}->${fresh.version}")
            _ui.value = _ui.value.copy(message = abort)
            return
        }
        dialVersion = fresh.version

        val error = CallPlacer.place(context, item.number, "CRM")
        if (error != null) {
            _ui.value = _ui.value.copy(message = error)
            return
        }
        source?.markDialed(item)
        awaitingContactId = contactId
        callStarted = false
        dialAt = SystemClock.elapsedRealtime()
        activeAt = null
        lastDialAt = dialAt
        dialTimes.addLast(dialAt!!)
        manualContactId = null
        _ui.value = _ui.value.copy(message = null, calling = true)
        CallBus.logEvent("CRM_DISCAGEM", item.number, "contato=$contactId")

        watchdog?.cancel()
        watchdog = scope.launch {
            delay(START_TIMEOUT_MS)
            if (!callStarted && awaitingContactId == contactId) {
                resetCallTracking()
                _ui.value = _ui.value.copy(calling = false, message = "A ligação não começou. Confira o sinal e toque em Tentar de novo.")
            }
        }
    }

    /** Intervalo mínimo e teto por hora (mesmos valores da fila local). */
    private fun rateBlock(): String? {
        val now = SystemClock.elapsedRealtime()
        while (dialTimes.isNotEmpty() && now - dialTimes.first() > HOUR_MS) dialTimes.removeFirst()
        if (dialTimes.size >= AutoDialer.MAX_CALLS_PER_HOUR) {
            return "Limite de ${AutoDialer.MAX_CALLS_PER_HOUR} ligações por hora atingido, para proteger o chip."
        }
        val last = lastDialAt
        if (last != null && now - last < AutoDialer.MIN_INTERVAL_MS) return "Aguardando o intervalo mínimo entre ligações."
        return null
    }

    private fun control(action: String) {
        val client = api ?: return
        scope.launch {
            try {
                val state = client.control(action)
                _ui.value = _ui.value.copy(state = state, message = null)
            } catch (e: CrmException) {
                if (e.sessionEnded) {
                    sessionEnded(e.message)
                } else {
                    _ui.value = _ui.value.copy(message = e.message)
                }
            }
        }
    }

    /** Envia os eventos em ordem; tenta de novo uma vez se a rede falhar. */
    private fun report(body: JSONObject) {
        val client = api ?: return
        scope.launch {
            reportLock.withLock {
                for (attempt in 0..1) {
                    try {
                        val state = client.event(body)
                        _ui.value = _ui.value.copy(state = state)
                        return@withLock
                    } catch (e: CrmException) {
                        if (e.sessionEnded) {
                            sessionEnded(e.message)
                            return@withLock
                        }
                        if (e.status != 0) {
                            CallBus.logEvent("CRM_EVENTO_RECUSADO", "-", "${body.optString("event")} | ${e.status} | ${e.message}")
                            // Discagem recusada (pausada, versão diferente): desliga já.
                            if (e.status == 409 && body.optString("event") == "dialing") {
                                if (CallBus.hasLiveCall()) CallBus.hangup()
                                _ui.value = _ui.value.copy(message = e.message)
                            }
                            return@withLock
                        }
                        if (attempt == 0) delay(1_000)
                    }
                }
            }
        }
    }

    private fun sessionEnded(message: String?) {
        // Encerrada na web: não deixa ligação da sessão aberta.
        if (awaitingContactId != null && CallBus.hasLiveCall()) CallBus.hangup()
        val context = appContext
        pollJob?.cancel()
        watchdog?.cancel()
        if (context != null) DeviceStore.clear(context)
        source = null
        api = null
        resetCallTracking()
        _ui.value = Ui(message = message ?: "A sessão terminou. Leia um novo QR.")
    }

    private fun resetCallTracking() {
        awaitingContactId = null
        callStarted = false
        dialAt = null
        activeAt = null
        watchdog?.cancel()
    }
}
