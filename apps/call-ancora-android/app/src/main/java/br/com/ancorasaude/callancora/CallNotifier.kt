package br.com.ancorasaude.callancora

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.telecom.Call

/**
 * Notificação fixa durante a ligação. Para ligação recebida, usa full-screen intent:
 * com a tela apagada ou bloqueada, o Android abre a [InCallActivity] direto.
 */
object CallNotifier {
    private const val CHANNEL_ID = "chamadas"
    private const val NOTIFICATION_ID = 7001

    const val ACTION_HANGUP = "br.com.ancorasaude.callancora.action.HANGUP"
    const val ACTION_ANSWER = "br.com.ancorasaude.callancora.action.ANSWER"

    private var inForeground = false

    private fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(CHANNEL_ID, "Ligações", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Ligação em andamento e ligação recebida"
            // O toque da ligação recebida é do próprio Android (Telecom), não da notificação.
            setSound(null, null)
            enableVibration(false)
        }
        nm.createNotificationChannel(channel)
    }

    /** Mostra ou atualiza a notificação. Tenta ficar em primeiro plano (tipo phoneCall). */
    fun show(service: Service, snap: CallSnapshot) {
        if (snap.state == Call.STATE_DISCONNECTED) return
        ensureChannel(service)
        val notification = build(service, snap)
        if (!inForeground) {
            try {
                service.startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
                inForeground = true
                return
            } catch (e: RuntimeException) {
                // Sem primeiro plano (restrição do aparelho): fica a notificação fixa comum.
            }
        }
        try {
            service.getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            // Sem permissão de notificação: a tela de chamada continua funcionando.
        }
    }

    fun hide(service: Service) {
        if (inForeground) {
            service.stopForeground(Service.STOP_FOREGROUND_REMOVE)
            inForeground = false
        }
        service.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
    }

    private fun build(context: Context, snap: CallSnapshot): Notification {
        val ringingIncoming = snap.isIncoming && snap.state == Call.STATE_RINGING
        val openCall = PendingIntent.getActivity(
            context,
            0,
            Intent(context, InCallActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val title = if (ringingIncoming) "Ligação recebida" else Labels.callState(snap.state, snap.isIncoming)
        val builder = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_phone)
            .setContentTitle("Call Âncora · $title")
            .setContentText(Phone.display(snap.number))
            .setCategory(Notification.CATEGORY_CALL)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openCall)
            .setColor(context.getColor(R.color.ancora_navy))

        if (ringingIncoming) {
            builder.setFullScreenIntent(openCall, true)
            builder.addAction(action(context, "Recusar", ACTION_HANGUP, 1))
            builder.addAction(action(context, "Atender", ACTION_ANSWER, 2))
        } else {
            builder.addAction(action(context, "Desligar", ACTION_HANGUP, 1))
        }
        return builder.build()
    }

    private fun action(context: Context, label: String, action: String, requestCode: Int): Notification.Action {
        val intent = Intent(context, CallActionReceiver::class.java).setAction(action)
        val pending = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return Notification.Action.Builder(null as Icon?, label, pending).build()
    }
}

/** Botões da notificação (Atender, Recusar, Desligar). */
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            CallNotifier.ACTION_ANSWER -> CallBus.answer()
            CallNotifier.ACTION_HANGUP -> CallBus.hangup()
        }
    }
}
