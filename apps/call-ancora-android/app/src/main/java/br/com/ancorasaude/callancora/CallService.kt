package br.com.ancorasaude.callancora

import android.content.Intent
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService

/**
 * O Android liga a este serviço quando o app é o discador padrão.
 * Cada ligação (feita ou recebida) chega aqui; os estados vão para o [CallBus].
 */
class CallService : InCallService() {

    private val callbacks = mutableMapOf<Call, Call.Callback>()

    override fun onCreate() {
        super.onCreate()
        CallBus.service = this
        SignalMonitor.start(this)
    }

    override fun onDestroy() {
        CallNotifier.hide(this)
        if (CallBus.service === this) CallBus.service = null
        super.onDestroy()
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        val callback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                CallBus.onStateChanged(call, state)
                refreshNotification()
            }

            override fun onDetailsChanged(call: Call, details: Call.Details) {
                CallBus.onDetailsChanged(call)
            }
        }
        call.registerCallback(callback)
        callbacks[call] = callback
        CallBus.onCallAdded(call)
        refreshNotification()

        // InCallService pode abrir a tela mesmo com o app em segundo plano.
        startActivity(
            Intent(this, InCallActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        )
    }

    override fun onCallRemoved(call: Call) {
        callbacks.remove(call)?.let { call.unregisterCallback(it) }
        CallBus.onCallRemoved(call)
        super.onCallRemoved(call)
        refreshNotification()
    }

    /** Notificação fixa enquanto houver ligação viva; some quando todas acabam. */
    private fun refreshNotification() {
        val snap = CallBus.current.value
        if (CallBus.hasLiveCall() && snap != null && snap.state != Call.STATE_DISCONNECTED) {
            CallNotifier.show(this, snap)
        } else {
            CallNotifier.hide(this)
        }
    }

    @Deprecated("Mantido para Android 10 a 13; ainda é chamado nas versões novas.")
    override fun onCallAudioStateChanged(audioState: CallAudioState) {
        @Suppress("DEPRECATION")
        super.onCallAudioStateChanged(audioState)
        CallBus.onAudioStateChanged(audioState)
    }
}
