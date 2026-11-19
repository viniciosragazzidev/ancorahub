package br.com.ancorasaude.callancora

import android.Manifest
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/** Cartão "Conectar ao AncoraHub" / sessão do CRM na tela principal. */
class CrmPanel(private val activity: MainActivity) {
    private val connectView: View = activity.findViewById(R.id.crmConnectView)
    private val sessionView: View = activity.findViewById(R.id.crmSessionView)
    private val tvCameraStatus: TextView = activity.findViewById(R.id.tvCameraStatus)
    private val btnScan: View = activity.findViewById(R.id.btnScan)
    private val tvAccount: TextView = activity.findViewById(R.id.tvCrmAccount)
    private val btnDisconnect: View = activity.findViewById(R.id.btnCrmDisconnect)
    private val tvProgress: TextView = activity.findViewById(R.id.tvCrmProgress)
    private val tvName: TextView = activity.findViewById(R.id.tvCrmName)
    private val tvNumber: TextView = activity.findViewById(R.id.tvCrmNumber)
    private val stateDot: View = activity.findViewById(R.id.crmStateDot)
    private val tvState: TextView = activity.findViewById(R.id.tvCrmState)
    private val tvInfo: TextView = activity.findViewById(R.id.tvCrmInfo)
    private val tvNext: TextView = activity.findViewById(R.id.tvCrmNext)
    private val btnCall: View = activity.findViewById(R.id.btnCrmCall)
    private val tvCallLabel: TextView = activity.findViewById(R.id.tvCrmCallLabel)
    private val btnPause: TextView = activity.findViewById(R.id.btnCrmPause)
    private val btnEnd: View = activity.findViewById(R.id.btnCrmEnd)
    private val tvError: TextView = activity.findViewById(R.id.tvCrmError)

    /** Erro do pareamento (QR inválido, vencido...). */
    var pairError: String? = null

    fun bind() {
        btnScan.setOnClickListener { pairError = null; activity.startQrScan() }
        tvCameraStatus.setOnClickListener { activity.startQrScan() }
        btnDisconnect.setOnClickListener {
            MaterialAlertDialogBuilder(activity)
                .setTitle("Desconectar do AncoraHub?")
                .setMessage("Este celular para de receber a fila. Para voltar, leia um novo QR.")
                .setPositiveButton("Desconectar") { _, _ -> CrmSession.disconnect(activity) }
                .setNegativeButton("Cancelar", null)
                .show()
        }
        btnCall.setOnClickListener {
            if (!Readiness.allReady(activity)) {
                Toast.makeText(activity, "Libere os itens de \"Preparar o celular\" antes de ligar.", Toast.LENGTH_LONG).show()
            } else {
                CrmSession.callCurrent()
            }
        }
        btnPause.setOnClickListener { CrmSession.togglePause() }
        btnEnd.setOnClickListener {
            Toast.makeText(activity, "Segure o botão para encerrar a sessão.", Toast.LENGTH_SHORT).show()
        }
        btnEnd.setOnLongClickListener {
            CrmSession.endSession()
            true
        }
    }

    fun render() {
        val ui = CrmSession.ui.value
        val connected = ui.connection != null
        connectView.visibility = if (connected) View.GONE else View.VISIBLE
        sessionView.visibility = if (connected) View.VISIBLE else View.GONE

        val cameraOk = ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (cameraOk) {
            tvCameraStatus.text = "✓ Câmera liberada"
            tvCameraStatus.setBackgroundResource(R.drawable.bg_chip_ok)
            tvCameraStatus.setTextColor(color(R.color.forest))
        } else {
            tvCameraStatus.text = "● Câmera: o app pede ao ler o QR"
            tvCameraStatus.setBackgroundResource(R.drawable.bg_chip_warn)
            tvCameraStatus.setTextColor(color(R.color.amber_ink))
        }

        val error = if (connected) null else pairError ?: ui.message
        tvError.text = error.orEmpty()
        tvError.visibility = if (error.isNullOrBlank()) View.GONE else View.VISIBLE
        if (!connected) return

        tvAccount.text = "✓ Conectado à conta de ${ui.connection?.brokerFirstName.orEmpty().ifBlank { "corretor" }}"
        val state = ui.state
        if (state == null) {
            tvProgress.text = "Carregando a sessão…"
            tvName.text = ""
            tvNumber.text = ""
            tvState.text = ""
            tvInfo.text = ui.message.orEmpty()
            tvNext.visibility = View.GONE
            btnCall.visibility = View.GONE
            btnEnd.visibility = View.GONE
            return
        }

        val current = state.current
        val empty = state.total == 0 && state.status != "ended"
        val ended = !empty && (state.status == "ended" || current == null)
        tvProgress.text = if (empty) {
            "Fila vazia"
        } else if (ended) {
            "${state.completed} de ${state.total} contatos"
        } else {
            "Contato ${minOf(state.completed + 1, state.total)} de ${state.total}"
        }
        tvName.text = when {
            empty -> "Sua fila está vazia"
            ended -> if (state.runState == "ended") "Sessão encerrada" else "Fila concluída"
            else -> current?.name.orEmpty()
        }
        tvNumber.text = when {
            empty || ended -> ""
            current?.dialable == true && current.phone != null -> Phone.display(current.phone)
            else -> "Contato bloqueado para ligação (o app não disca)"
        }

        val (label, dot) = stateLabel(ui, state)
        tvState.text = label
        stateDot.backgroundTintList = ColorStateList.valueOf(color(dot))

        tvInfo.text = ui.message ?: if (empty) "Ainda não há frios na sua fila. Assim que a base de frios estiver ligada, eles aparecem aqui." else when {
            state.paused -> if (state.pausedBy == "phone") "Sessão pausada no celular." else "Pausado pela tela."
            state.countdownSeconds != null ->
                if (state.countdownPaused) "Contagem pausada." else "Próxima ligação em ${state.countdownSeconds} s."
            state.awaitingClassification -> "Classifique a ligação na tela do computador."
            state.autoDialEnabled -> "Discagem automática ligada na web."
            else -> "Discagem automática desligada na web: toque em Ligar para cada contato."
        }

        val next = state.next
        tvNext.text = next?.let { "Próximo: ${it.name}" + (it.phoneMasked?.let { m -> " · $m" } ?: "") }.orEmpty()
        tvNext.visibility = if (next == null) View.GONE else View.VISIBLE

        val canCall = !ended && current?.dialable == true && state.callStatus == "ready" && !ui.calling && !state.paused
        val retry = ui.message?.startsWith("A ligação não começou") == true
        val needsTap = !ui.started || !state.autoDialEnabled || retry
        btnCall.visibility = if (canCall && needsTap) View.VISIBLE else View.GONE
        btnCall.alpha = if (Readiness.allReady(activity)) 1f else 0.4f
        tvCallLabel.text = when {
            retry -> "Tentar de novo"
            !ui.started -> "Começar ligações"
            else -> "Ligar para o próximo"
        }
        btnPause.text = if (state.paused) "Continuar" else "Pausar"
        btnEnd.visibility = if (ui.started) View.VISIBLE else View.INVISIBLE
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
                val cause = last?.causeLabel?.let { " · $it" }.orEmpty()
                val text = when {
                    last == null -> "Ligação encerrada"
                    last.voicemail -> "Provável caixa postal$cause"
                    last.noAnswer -> "Não atendeu$cause"
                    else -> "Encerrada$cause · ${Labels.clock(last.talkSeconds * 1000L)}"
                }
                text to R.color.hangup_red
            }
        }
    }

    private fun color(id: Int) = ContextCompat.getColor(activity, id)
}
