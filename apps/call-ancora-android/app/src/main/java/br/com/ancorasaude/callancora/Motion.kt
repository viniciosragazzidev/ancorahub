package br.com.ancorasaude.callancora

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.graphics.Color
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.provider.Settings
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.MotionEvent
import android.view.View
import android.view.animation.PathInterpolator
import android.widget.TextView
import androidx.dynamicanimation.animation.DynamicAnimation
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce

/**
 * Animações do Call Âncora. Molas com física (androidx.dynamicanimation) para tudo o que
 * entra e se move; nada repete em loop. Com "Remover animações" ligado no Android
 * (escala de animação 0), cada peça aparece pronta, sem movimento.
 */
object Motion {
    /** Curva de entrada do AncoraHub (mesma do motion-tokens.ts: ease-out expressivo). */
    private val easeEnter = PathInterpolator(0.16f, 1f, 0.3f, 1f)

    fun enabled(view: View): Boolean =
        Settings.Global.getFloat(view.context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f

    private fun View.dp(value: Float) = value * resources.displayMetrics.density

    private fun spring(view: View, property: DynamicAnimation.ViewProperty, from: Float, to: Float, stiffness: Float, damping: Float, delayMs: Long = 0) {
        property.setValue(view, from)
        val run = {
            SpringAnimation(view, property, to).apply {
                spring.stiffness = stiffness
                spring.dampingRatio = damping
                setStartValue(from)
                start()
            }
        }
        if (delayMs > 0) view.postDelayed({ run() }, delayMs) else run()
    }

    /** Tela entrando: sobe 32dp, cresce de 96% e aparece, numa mola suave. */
    fun enterScreen(view: View, delayMs: Long = 0) {
        if (!enabled(view)) return
        view.alpha = 0f
        view.animate().alpha(1f).setStartDelay(delayMs).setDuration(260).setInterpolator(easeEnter).start()
        spring(view, DynamicAnimation.TRANSLATION_Y, view.dp(32f), 0f, SpringForce.STIFFNESS_LOW, 0.82f, delayMs)
        spring(view, DynamicAnimation.SCALE_X, 0.96f, 1f, SpringForce.STIFFNESS_LOW, 0.8f, delayMs)
        spring(view, DynamicAnimation.SCALE_Y, 0.96f, 1f, SpringForce.STIFFNESS_LOW, 0.8f, delayMs)
    }

    /** Peça que "estoura" para dentro (mascote, selo de conectado): escala com leve quique. */
    fun pop(view: View, delayMs: Long = 0) {
        if (!enabled(view)) return
        view.alpha = 0f
        view.animate().alpha(1f).setStartDelay(delayMs).setDuration(180).start()
        spring(view, DynamicAnimation.SCALE_X, 0.6f, 1f, SpringForce.STIFFNESS_MEDIUM, 0.55f, delayMs)
        spring(view, DynamicAnimation.SCALE_Y, 0.6f, 1f, SpringForce.STIFFNESS_MEDIUM, 0.55f, delayMs)
    }

    /** Contato novo chegando: desliza da direita com mola, como um cartão empurrado para a mesa. */
    fun slideIn(view: View) {
        if (!enabled(view)) return
        view.alpha = 0f
        view.animate().alpha(1f).setStartDelay(0).setDuration(220).setInterpolator(easeEnter).start()
        spring(view, DynamicAnimation.TRANSLATION_X, view.dp(72f), 0f, SpringForce.STIFFNESS_LOW, 0.78f)
    }

    /** Peças em cascata (botões do feedback): cada uma sobe 16dp, 40 ms depois da anterior. */
    fun stagger(views: List<View>, startDelayMs: Long = 0) {
        views.forEachIndexed { index, view ->
            if (!enabled(view)) return@forEachIndexed
            val delay = startDelayMs + index * 40L
            view.alpha = 0f
            view.animate().alpha(1f).setStartDelay(delay).setDuration(200).setInterpolator(easeEnter).start()
            spring(view, DynamicAnimation.TRANSLATION_Y, view.dp(16f), 0f, SpringForce.STIFFNESS_MEDIUM, 0.75f, delay)
        }
    }

    /** Número do contador trocando: um pulso curto de escala, sem repetir sozinho. */
    fun tick(view: View) {
        if (!enabled(view)) return
        spring(view, DynamicAnimation.SCALE_X, 1.18f, 1f, SpringForce.STIFFNESS_MEDIUM, 0.5f)
        spring(view, DynamicAnimation.SCALE_Y, 1.18f, 1f, SpringForce.STIFFNESS_MEDIUM, 0.5f)
    }

    /**
     * Nome aparecendo letra por letra: cada letra vai do transparente ao sólido em cascata,
     * o texto sobe numa mola e (Android 12+) sai de um desfoque para nítido.
     */
    fun revealText(view: TextView, text: CharSequence, delayMs: Long = 0) {
        view.text = text
        if (!enabled(view) || text.isEmpty()) return
        val base = view.currentTextColor
        val letters = text.length
        val perLetter = 0.35f / letters.coerceAtLeast(1)
        val window = 0.65f
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = (420L + letters * 22L).coerceAtMost(900L)
            startDelay = delayMs
            interpolator = easeEnter
            addUpdateListener { animation ->
                val progress = animation.animatedValue as Float
                val spannable = SpannableString(text)
                for (i in 0 until letters) {
                    val local = ((progress - i * perLetter) / window).coerceIn(0f, 1f)
                    val alpha = (Color.alpha(base) * local).toInt()
                    spannable.setSpan(
                        ForegroundColorSpan(Color.argb(alpha, Color.red(base), Color.green(base), Color.blue(base))),
                        i, i + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                }
                view.text = spannable
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val blur = 10f * (1f - progress)
                    view.setRenderEffect(if (blur < 0.5f) null else RenderEffect.createBlurEffect(blur, blur, Shader.TileMode.DECAL))
                }
            }
            doOnEndCompat { view.text = text; if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) view.setRenderEffect(null) }
        }
        spring(view, DynamicAnimation.TRANSLATION_Y, view.dp(14f), 0f, SpringForce.STIFFNESS_LOW, 0.8f, delayMs)
        animator.start()
    }

    /** Toque nos botões: afunda para 96% e volta numa mola, como um botão físico. */
    @SuppressLint("ClickableViewAccessibility")
    fun pressable(view: View) {
        view.setOnTouchListener { v, event ->
            if (enabled(v)) {
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.96f).scaleY(0.96f).setStartDelay(0).setDuration(90).start()
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        spring(v, DynamicAnimation.SCALE_X, v.scaleX, 1f, SpringForce.STIFFNESS_MEDIUM, 0.45f)
                        spring(v, DynamicAnimation.SCALE_Y, v.scaleY, 1f, SpringForce.STIFFNESS_MEDIUM, 0.45f)
                    }
                }
            }
            false
        }
    }

    private fun ValueAnimator.doOnEndCompat(block: () -> Unit) {
        addListener(object : android.animation.AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) = block()
        })
    }
}
