package br.com.ancorasaude.callancora

import android.os.Bundle
import android.os.SystemClock
import android.telecom.Call
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Tela de chamada mínima, exigida para um discador padrão. */
class InCallActivity : AppCompatActivity() {

    private lateinit var tvDirection: TextView
    private lateinit var tvNumber: TextView
    private lateinit var tvState: TextView
    private lateinit var tvTimer: TextView
    private lateinit var btnAnswer: MaterialButton
    private lateinit var btnHangup: MaterialButton
    private lateinit var btnMute: MaterialButton
    private lateinit var btnSpeaker: MaterialButton

    private var closeJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_in_call)

        tvDirection = findViewById(R.id.tvDirection)
        tvNumber = findViewById(R.id.tvNumber)
        tvState = findViewById(R.id.tvState)
        tvTimer = findViewById(R.id.tvTimer)
        btnAnswer = findViewById(R.id.btnAnswer)
        btnHangup = findViewById(R.id.btnHangup)
        btnMute = findViewById(R.id.btnMute)
        btnSpeaker = findViewById(R.id.btnSpeaker)

        btnAnswer.setOnClickListener { CallBus.answer() }
        btnHangup.setOnClickListener { CallBus.hangup() }
        btnMute.setOnClickListener { CallBus.toggleMute() }
        btnSpeaker.setOnClickListener { CallBus.toggleSpeaker() }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { CallBus.current.collect { render() } }
                launch {
                    CallBus.audio.collect { audio ->
                        btnMute.text = if (audio.muted) "Mudo: ligado" else "Mudo"
                        btnSpeaker.text = if (audio.speaker) "Viva-voz: ligado" else "Viva-voz"
                    }
                }
                launch {
                    while (true) {
                        renderTimer()
                        delay(500)
                    }
                }
            }
        }
    }

    private fun render() {
        val snap = CallBus.current.value
        if (snap == null) {
            finishSoon()
            return
        }
        tvDirection.text = if (snap.isIncoming) "Ligação recebida" else "Ligação para"
        tvNumber.text = snap.number
        tvState.text = buildString {
            append(CallBus.stateLabel(snap.state))
            append(" (")
            append(CallBus.stateName(snap.state))
            append(")")
            snap.disconnectLabel?.let { append("\n").append(it) }
        }
        val ringingIncoming = snap.isIncoming && snap.state == Call.STATE_RINGING
        btnAnswer.visibility = if (ringingIncoming) View.VISIBLE else View.GONE
        btnHangup.text = if (ringingIncoming) "Recusar" else "Desligar"
        val ended = snap.state == Call.STATE_DISCONNECTED
        btnHangup.isEnabled = !ended
        btnMute.isEnabled = !ended
        btnSpeaker.isEnabled = !ended
        if (ended) finishSoon() else cancelFinish()
    }

    /** Uma nova ligação chegou enquanto a tela fechava: mantém a tela aberta. */
    private fun cancelFinish() {
        closeJob?.cancel()
        closeJob = null
    }

    private fun renderTimer() {
        val snap = CallBus.current.value ?: return
        if (snap.state == Call.STATE_DISCONNECTED) return
        val ms = if (snap.connectTimeMillis > 0) {
            System.currentTimeMillis() - snap.connectTimeMillis
        } else {
            SystemClock.elapsedRealtime() - snap.addedAtElapsed
        }
        val total = (ms / 1000).coerceAtLeast(0)
        val prefix = if (snap.connectTimeMillis > 0) "" else "aguardando "
        tvTimer.text = "%s%02d:%02d".format(prefix, total / 60, total % 60)
    }

    private fun finishSoon() {
        if (closeJob != null) return
        closeJob = lifecycleScope.launch {
            delay(1500)
            finish()
        }
    }
}
