package br.com.ancorasaude.callancora

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telephony.PhoneStateListener
import android.telephony.ServiceState
import android.telephony.SubscriptionManager
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.Executor

/**
 * Acompanha o sinal de voz da operadora no chip padrão de ligações.
 * Sem sinal, o Android recusa a ligação na hora (DisconnectCause ERROR, OUT_OF_SERVICE),
 * então Ligar e a fila automática ficam bloqueados até o sinal voltar.
 */
object SignalMonitor {

    enum class Status(val message: String) {
        IN_SERVICE("Sinal da operadora"),
        AIRPLANE("Desligue o modo avião"),
        NO_SIM("Coloque um chip"),
        NO_SERVICE("Sem sinal da operadora"),
        UNKNOWN("Verificando o sinal da operadora…"),
    }

    private val _status = MutableStateFlow(Status.UNKNOWN)
    val status: StateFlow<Status> = _status.asStateFlow()

    val inService: Boolean get() = _status.value == Status.IN_SERVICE

    private val main = Handler(Looper.getMainLooper())
    private val mainExecutor = Executor { main.post(it) }
    private var appContext: Context? = null
    private var telephony: TelephonyManager? = null
    private var lastServiceState: Int? = null
    private var registered = false

    /** Começa a ouvir (uma vez por processo). Pode ser chamado de qualquer tela ou serviço. */
    fun start(context: Context) {
        if (appContext != null) {
            telephony?.let {
                if (lastServiceState == null) readInitial(it)
                tryRegister(it)
            }
            recompute()
            return
        }
        val app = context.applicationContext
        appContext = app
        val base = app.getSystemService(TelephonyManager::class.java) ?: run {
            _status.value = Status.NO_SERVICE
            return
        }
        val subId = SubscriptionManager.getDefaultVoiceSubscriptionId()
        val tm = if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            base.createForSubscriptionId(subId)
        } else {
            base
        }
        telephony = tm

        readInitial(tm)
        tryRegister(tm)
        recompute()
    }

    /** Valor inicial, se a permissão de estado do telefone já existir. */
    private fun readInitial(tm: TelephonyManager) {
        val context = appContext ?: return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        try {
            tm.serviceState?.let { lastServiceState = it.state }
        } catch (e: SecurityException) {
            // Espera o retorno do listener.
        }
    }

    /** Registra o listener; se falhar (ex.: permissão ainda não dada), tenta no próximo start(). */
    private fun tryRegister(tm: TelephonyManager) {
        if (registered) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                tm.registerTelephonyCallback(mainExecutor, ServiceStateCallback())
            } else {
                listenLegacy(tm)
            }
            registered = true
        } catch (e: RuntimeException) {
            // Sem listener por enquanto.
        }
    }

    @Suppress("DEPRECATION")
    private fun listenLegacy(tm: TelephonyManager) {
        main.post {
            tm.listen(
                object : PhoneStateListener() {
                    @Deprecated("Android 11 ou anterior")
                    override fun onServiceStateChanged(serviceState: ServiceState?) {
                        onServiceState(serviceState)
                    }
                },
                PhoneStateListener.LISTEN_SERVICE_STATE,
            )
        }
    }

    private class ServiceStateCallback : TelephonyCallback(), TelephonyCallback.ServiceStateListener {
        override fun onServiceStateChanged(serviceState: ServiceState) {
            onServiceState(serviceState)
        }
    }

    private fun onServiceState(serviceState: ServiceState?) {
        lastServiceState = serviceState?.state
        recompute()
    }

    /** Reavalia modo avião, chip e registro de voz. */
    fun recompute() {
        val context = appContext ?: return
        val airplane = Settings.Global.getInt(context.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1
        val simState = telephony?.simState ?: TelephonyManager.SIM_STATE_UNKNOWN
        val newStatus = when {
            airplane -> Status.AIRPLANE
            simState == TelephonyManager.SIM_STATE_ABSENT -> Status.NO_SIM
            lastServiceState == ServiceState.STATE_IN_SERVICE -> Status.IN_SERVICE
            lastServiceState == ServiceState.STATE_POWER_OFF -> Status.AIRPLANE
            lastServiceState == null -> Status.UNKNOWN
            // OUT_OF_SERVICE e EMERGENCY_ONLY: não dá para ligar para número comum.
            else -> Status.NO_SERVICE
        }
        if (newStatus != _status.value) {
            _status.value = newStatus
            AutoDialer.onSignalChanged(newStatus == Status.IN_SERVICE)
        }
    }
}
