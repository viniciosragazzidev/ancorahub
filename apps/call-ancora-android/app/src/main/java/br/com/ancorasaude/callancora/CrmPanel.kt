package br.com.ancorasaude.callancora

import android.content.res.ColorStateList
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/**
 * As telas do app, uma por vez: conectar (QR) → boas-vindas → preparar o celular (só se
 * faltar algo) → ligações. Na tela de ligações só ficam o contato ativo, o feedback depois
 * da ligação, o contador para a próxima, o botão de começar e o próximo contato.
 * Nada de configuração: regras e limites vêm do diretor, pelo servidor.
 */
class CrmPanel(private val activity: MainActivity) {
    private val btnExit: View = activity.findViewById(R.id.btnExit)
    private val connectView: View = activity.findViewById(R.id.connectView)
    private val btnScan: View = activity.findViewById(R.id.btnScan)
    private val tvConnectError: TextView = activity.findViewById(R.id.tvConnectError)
    private val welcomeView: View = activity.findViewById(R.id.welcomeView)
    private val tvWelcome: TextView = activity.findViewById(R.id.tvWelcome)
    private val welcomeMascot: View = activity.findViewById(R.id.welcomeMascot)
    private val tvWelcomeSub: View = activity.findViewById(R.id.tvWelcomeSub)
    private val currentCard: View = activity.findViewById(R.id.currentCard)
    private val prepareView: View = activity.findViewById(R.id.prepareView)
    private val callView: View = activity.findViewById(R.id.callView)
    private val tvProgress: TextView = activity.findViewById(R.id.tvProgress)
    private val tvName: TextView = activity.findViewById(R.id.tvName)
    private val tvNumber: TextView = activity.findViewById(R.id.tvNumber)
    private val stateRow: View = activity.findViewById(R.id.stateRow)
    private val stateDot: View = activity.findViewById(R.id.stateDot)
    private val tvState: TextView = activity.findViewById(R.id.tvState)
    private val feedbackView: View = activity.findViewById(R.id.feedbackView)
    private val countdownView: View = activity.findViewById(R.id.countdownView)
    private val tvCountdown: TextView = activity.findViewById(R.id.tvCountdown)
    private val btnCall: View = activity.findViewById(R.id.btnCall)
    private val tvCallLabel: TextView = activity.findViewById(R.id.tvCallLabel)
    private val tvInfo: TextView = activity.findViewById(R.id.tvInfo)
    private val nextCard: View = activity.findViewById(R.id.nextCard)
    private val tvNextName: TextView = activity.findViewById(R.id.tvNextName)
    private val tvNextNumber: TextView = activity.findViewById(R.id.tvNextNumber)

    private val handler = Handler(Looper.getMainLooper())

    /** Erro do pareamento (QR inválido, vencido...). */
    var pairError: String? = null

    /** Sessão já recebeu as boas-vindas neste processo (evita repetir a cada leitura). */
    private var welcomedSession: String? = null
    private var welcomeVisible = false

    /** Tela visível agora; a troca dispara a animação de entrada. */
    private var screen: View? = null
    /** O que já está na tela, para animar só quando muda. */
    private var shownContactKey: String? = null
    private var shownNextId: String? = null
    private var shownCountdown: Int? = null
    private var feedbackShown = false

    fun bind() {
        btnScan.setOnClickListener { pairError = null; activity.startQrScan() }
        btnExit.setOnClickListener {
            MaterialAlertDialogBuilder(activity)
                .setTitle("Sair do Call Âncora?")
                .setMessage("A sessão de ligações termina. Para voltar, leia um novo QR no computador.")
                .setPositiveButton("Sair") { _, _ -> CrmSession.endSession() }
                .setNegativeButton("Cancelar", null)
                .show()
        }
        btnCall.setOnClickListener {
            if (!Readiness.allReady(activity)) {
                Toast.makeText(activity, "Libere os itens do celular antes de ligar.", Toast.LENGTH_LONG).show()
            } else {
                CrmSession.callCurrent()
            }
        }
        listOf(btnScan, btnCall, btnExit).forEach(Motion::pressable)
        mapOf(
            R.id.btnInterested to "interested",
            R.id.btnNotInterested to "not_interested",
            R.id.btnVoicemail to "voicemail",
            R.id.btnNoAnswer to "no_answer",
            R.id.btnWrongNumber to "wrong_number",
        ).forEach { (id, outcome) ->
            activity.findViewById<View>(id).apply {
                Motion.pressable(this)
                setOnClickListener { CrmSession.classify(outcome) }
            }
        }
    }

    fun render() {
        val ui = CrmSession.ui.value
        val connection = ui.connection
        btnExit.visibility = if (connection != null) View.VISIBLE else View.GONE

        if (connection == null) {
            welcomedSession = null
            welcomeVisible = false
            handler.removeCallbacksAndMessages(null)
            show(connectView)
            val error = pairError ?: ui.message
            tvConnectError.text = error.orEmpty()
            tvConnectError.visibility = if (error.isNullOrBlank()) View.GONE else View.VISIBLE
            return
        }

        // Boas-vindas: uma vez por sessão, alguns segundos, com o nome do corretor.
        if (welcomedSession != connection.sessionId) {
            welcomedSession = connection.sessionId
            welcomeVisible = true
            show(welcomeView)
            Motion.pop(welcomeMascot)
            Motion.revealText(tvWelcome, "Olá, ${connection.brokerFirstName.ifBlank { "corretor" }}!", delayMs = 180)
            Motion.stagger(listOf(tvWelcomeSub), startDelayMs = 520)
            handler.postDelayed({ welcomeVisible = false; render() }, WELCOME_MS)
            return
        }
        if (welcomeVisible) {
            show(welcomeView)
            return
        }
        if (!Readiness.allReady(activity)) {
            show(prepareView)
            return
        }
        show(callView)
        renderCall(ui)
    }

    private fun renderCall(ui: CrmSession.Ui) {
        val state = ui.state
        if (state == null) {
            tvProgress.text = ""
            tvName.text = "Carregando…"
            tvNumber.text = ""
            stateRow.visibility = View.GONE
            feedbackView.visibility = View.GONE
            countdownView.visibility = View.GONE
            btnCall.visibility = View.GONE
            nextCard.visibility = View.GONE
            info(ui.message)
            return
        }

        val current = state.current
        val empty = state.total == 0 && state.status != "ended"
        val ended = !empty && (state.status == "ended" || current == null)
        tvProgress.text = when {
            empty -> "Fila vazia"
            ended -> "${state.completed} de ${state.total} contatos"
            else -> "Contato ${minOf(state.completed + 1, state.total)} de ${state.total}"
        }
        val name = when {
            empty -> "Sua fila está vazia"
            ended -> if (state.runState == "ended") "Sessão encerrada" else "Fila concluída"
            else -> current?.name.orEmpty()
        }
        val contactKey = "${current?.id}|$name"
        if (contactKey != shownContactKey) {
            val first = shownContactKey == null
            shownContactKey = contactKey
            if (!first) Motion.slideIn(currentCard)
            Motion.revealText(tvName, name, delayMs = if (first) 120 else 160)
        }
        tvNumber.text = when {
            empty || ended -> ""
            current?.dialable == true && current.phone != null -> Phone.display(current.phone)
            !state.callingWindowOpen -> "Fora do horário de ligações"
            else -> "Contato bloqueado para ligação"
        }
        tvNumber.visibility = if (tvNumber.text.isNullOrEmpty()) View.GONE else View.VISIBLE

        stateRow.visibility = if (empty || ended) View.GONE else View.VISIBLE
        val (label, dot) = stateLabel(ui, state)
        tvState.text = label
        stateDot.backgroundTintList = ColorStateList.valueOf(color(dot))

        val askFeedback = !ended && state.awaitingClassification
        feedbackView.visibility = if (askFeedback) View.VISIBLE else View.GONE
        if (askFeedback && !feedbackShown) {
            Motion.stagger(
                listOf(R.id.btnInterested, R.id.btnNotInterested, R.id.btnVoicemail, R.id.btnNoAnswer, R.id.btnWrongNumber)
                    .map { activity.findViewById<View>(it) },
            )
        }
        feedbackShown = askFeedback

        val countdown = state.countdownSeconds
        countdownView.visibility = if (!ended && countdown != null && !state.countdownPaused) View.VISIBLE else View.GONE
        tvCountdown.text = "${countdown ?: 0} s"
        if (countdownView.visibility == View.VISIBLE && countdown != shownCountdown) {
            if (shownCountdown == null) Motion.pop(countdownView) else Motion.tick(tvCountdown)
        }
        shownCountdown = if (countdownView.visibility == View.VISIBLE) countdown else null

        val canCall = !ended && current?.dialable == true && state.callStatus == "ready" && !ui.calling && !state.paused
        val retry = ui.message?.startsWith("A ligação não começou") == true
        val needsTap = !ui.started || !state.autoDialEnabled || retry
        btnCall.visibility = if (canCall && needsTap && countdownView.visibility != View.VISIBLE) View.VISIBLE else View.GONE
        tvCallLabel.text = if (retry) "Tentar de novo" else "Começar ligação"

        val next = state.next
        nextCard.visibility = if (next == null || ended) View.GONE else View.VISIBLE
        if (next != null && !ended && next.id != shownNextId) {
            if (shownNextId != null) Motion.enterScreen(nextCard, delayMs = 220)
            shownNextId = next.id
        }
        tvNextName.text = next?.name.orEmpty()
        tvNextNumber.text = next?.phoneMasked.orEmpty()
        tvNextNumber.visibility = if (next?.phoneMasked.isNullOrBlank()) View.GONE else View.VISIBLE

        info(
            ui.message ?: when {
                empty -> "Assim que houver contatos para você, eles aparecem aqui."
                state.paused -> "Sessão pausada pelo AncoraHub."
                else -> null
            },
        )
    }

    private fun info(text: String?) {
        tvInfo.text = text.orEmpty()
        tvInfo.visibility = if (text.isNullOrBlank()) View.GONE else View.VISIBLE
    }

    private fun show(target: View) {
        listOf(connectView, welcomeView, prepareView, callView).forEach {
            it.visibility = if (it === target) View.VISIBLE else View.GONE
        }
        if (screen !== target) {
            screen = target
            if (target === callView) {
                shownContactKey = null
                shownNextId = null
                shownCountdown = null
            }
            Motion.enterScreen(target)
        }
    }

    /** Estado da ligação: o do próprio celular durante a chamada, senão o do servidor. */
    private fun stateLabel(ui: CrmSession.Ui, state: CrmState): Pair<String, Int> {
        val local = CallBus.current.value
        if (ui.calling && local != null && local.state != android.telecom.Call.STATE_DISCONNECTED) {
            return Labels.callState(local.state, local.isIncoming) to Labels.callStateDot(local.state, local.isIncoming)
        }
        return when (state.callStatus) {
            "ready" -> "Pronto para ligar" to R.color.dot_neutral
            "dialing" -> "Discando" to R.color.ancora_blue
            "ringing" -> "Chamando" to R.color.ancora_blue
            "active" -> "Em ligação" to R.color.ancora_green
            else -> {
                val last = state.lastCall
                val text = when {
                    last == null -> "Ligação encerrada"
                    last.voicemail -> "Provável caixa postal"
                    last.noAnswer -> "Não atendeu"
                    else -> "Encerrada · ${Labels.clock(last.talkSeconds * 1000L)}"
                }
                text to R.color.hangup_red
            }
        }
    }

    private fun color(id: Int) = ContextCompat.getColor(activity, id)

    companion object {
        private const val WELCOME_MS = 2_500L
    }
}
