package br.com.ancorasaude.callancora

import android.animation.ValueAnimator
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.os.SystemClock
import android.telecom.Call
import android.util.TypedValue
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import androidx.annotation.ColorRes
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Tela de chamada mínima, exigida para um discador padrão. Visual do AncoraHub Lite. */
class InCallActivity : AppCompatActivity() {

    private lateinit var ringOuter: View
    private lateinit var ringInner: View
    private lateinit var avatar: View
    private lateinit var tvNumber: TextView
    private lateinit var tvDirection: TextView
    private lateinit var stateDot: View
    private lateinit var tvState: TextView
    private lateinit var tvTimer: TextView
    private lateinit var summaryCard: View
    private lateinit var tvSumTalk: TextView
    private lateinit var tvSumReason: TextView
    private lateinit var tvSumAnswer: TextView
    private lateinit var controlsRow: View
    private lateinit var btnMute: ImageView
    private lateinit var tvMute: TextView
    private lateinit var btnSpeaker: ImageView
    private lateinit var tvSpeaker: TextView
    private lateinit var btnHangup: View
    private lateinit var incomingRow: View
    private lateinit var btnBack: View

    private var pulse: ValueAnimator? = null
    private var timerBig: Boolean? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_in_call)

        ringOuter = findViewById(R.id.ringOuter)
        ringInner = findViewById(R.id.ringInner)
        avatar = findViewById(R.id.avatar)
        tvNumber = findViewById(R.id.tvNumber)
        tvDirection = findViewById(R.id.tvDirection)
        stateDot = findViewById(R.id.stateDot)
        tvState = findViewById(R.id.tvState)
        tvTimer = findViewById(R.id.tvTimer)
        summaryCard = findViewById(R.id.summaryCard)
        tvSumTalk = findViewById(R.id.tvSumTalk)
        tvSumReason = findViewById(R.id.tvSumReason)
        tvSumAnswer = findViewById(R.id.tvSumAnswer)
        controlsRow = findViewById(R.id.controlsRow)
        btnMute = findViewById(R.id.btnMute)
        tvMute = findViewById(R.id.tvMute)
        btnSpeaker = findViewById(R.id.btnSpeaker)
        tvSpeaker = findViewById(R.id.tvSpeaker)
        btnHangup = findViewById(R.id.btnHangup)
        incomingRow = findViewById(R.id.incomingRow)
        btnBack = findViewById(R.id.btnBack)

        AppFonts.applyTree(findViewById(android.R.id.content))

        btnHangup.setOnClickListener { CallBus.hangup() }
        findViewById<View>(R.id.btnReject).setOnClickListener { CallBus.hangup() }
        findViewById<View>(R.id.btnAnswer).setOnClickListener { CallBus.answer() }
        btnMute.setOnClickListener { CallBus.toggleMute() }
        btnSpeaker.setOnClickListener { CallBus.toggleSpeaker() }
        btnBack.setOnClickListener { backToTest() }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { CallBus.current.collect { render(it) } }
                launch {
                    CallBus.audio.collect { audio ->
                        styleToggle(btnMute, audio.muted, if (audio.muted) R.drawable.ic_mic_off else R.drawable.ic_mic)
                        tvMute.text = if (audio.muted) "Mudo ligado" else "Mudo"
                        styleToggle(btnSpeaker, audio.speaker, R.drawable.ic_speaker)
                        tvSpeaker.text = if (audio.speaker) "Viva-voz ligado" else "Viva-voz"
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

    override fun onStop() {
        stopPulse()
        super.onStop()
    }

    private fun render(snap: CallSnapshot?) {
        if (snap == null) {
            finish()
            return
        }
        val ended = snap.state == Call.STATE_DISCONNECTED
        val active = snap.state == Call.STATE_ACTIVE
        val ringingIncoming = snap.isIncoming && snap.state == Call.STATE_RINGING

        tvNumber.text = Phone.display(snap.number)
        tvDirection.text = if (snap.isIncoming) "Ligação recebida" else "Ligação para"
        tvDirection.visibility = if (ended) View.GONE else View.VISIBLE
        tvState.text = Labels.callState(snap.state, snap.isIncoming)
        tint(stateDot, Labels.callStateDot(snap.state, snap.isIncoming))

        // Anéis: verdes e pulsando enquanto chama; um anel firme em ligação; nenhum ao encerrar.
        when {
            ended -> {
                ringOuter.visibility = View.GONE
                ringInner.visibility = View.GONE
                avatar.alpha = 0.6f
            }
            active -> {
                ringOuter.visibility = View.GONE
                ringInner.visibility = View.VISIBLE
                tint(ringInner, R.color.ring_green_90)
                avatar.alpha = 1f
            }
            else -> {
                ringOuter.visibility = View.VISIBLE
                ringInner.visibility = View.VISIBLE
                tint(ringOuter, R.color.ring_lime_22)
                tint(ringInner, R.color.ring_lime_55)
                avatar.alpha = 1f
            }
        }
        if (!ended && !active) startPulse() else stopPulse()

        tvTimer.visibility = if (ended || ringingIncoming) View.GONE else View.VISIBLE
        controlsRow.visibility = if (ended || ringingIncoming) View.GONE else View.VISIBLE
        btnHangup.visibility = if (ended || ringingIncoming) View.GONE else View.VISIBLE
        incomingRow.visibility = if (ringingIncoming) View.VISIBLE else View.GONE
        summaryCard.visibility = if (ended) View.VISIBLE else View.GONE
        btnBack.visibility = if (ended) View.VISIBLE else View.GONE

        if (ended) {
            tvSumTalk.text = Labels.clock(snap.talkMs ?: 0L)
            tvSumReason.text = Labels.disconnectReason(snap.disconnectCode, snap.isIncoming)
            tvSumAnswer.text = snap.timeToActiveMs?.let { Labels.seconds(it) } ?: "Não atendeu"
        }
        renderTimer()
    }

    /** "00:03" apagado enquanto espera; grande quando a ligação está ativa. */
    private fun renderTimer() {
        val snap = CallBus.current.value ?: return
        if (snap.state == Call.STATE_DISCONNECTED) return
        val running = snap.connectTimeMillis > 0
        val ms = if (running) {
            System.currentTimeMillis() - snap.connectTimeMillis
        } else {
            SystemClock.elapsedRealtime() - snap.addedAtElapsed
        }
        if (timerBig != running) {
            timerBig = running
            tvTimer.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (running) 34f else 20f)
            tvTimer.alpha = if (running) 1f else 0.55f
        }
        tvTimer.text = Labels.clock(ms)
    }

    private fun styleToggle(button: ImageView, on: Boolean, icon: Int) {
        button.setImageResource(icon)
        tint(button, if (on) R.color.white else R.color.white_12)
        button.imageTintList = ColorStateList.valueOf(
            ContextCompat.getColor(this, if (on) R.color.ancora_navy else R.color.white),
        )
    }

    private fun tint(view: View, @ColorRes color: Int) {
        view.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, color))
    }

    /** Respiração suave dos anéis. Desligada se o aparelho desativou animações. */
    private fun startPulse() {
        if (pulse != null || !ValueAnimator.areAnimatorsEnabled()) return
        pulse = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1100
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            addUpdateListener { animator ->
                val f = animator.animatedValue as Float
                val outer = 0.92f + 0.08f * f
                val inner = 0.96f + 0.04f * f
                ringOuter.scaleX = outer
                ringOuter.scaleY = outer
                ringOuter.alpha = 1f - 0.5f * f
                ringInner.scaleX = inner
                ringInner.scaleY = inner
            }
            start()
        }
    }

    private fun stopPulse() {
        pulse?.cancel()
        pulse = null
        listOf(ringOuter, ringInner).forEach {
            it.scaleX = 1f
            it.scaleY = 1f
            it.alpha = 1f
        }
    }

    private fun backToTest() {
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }
}
