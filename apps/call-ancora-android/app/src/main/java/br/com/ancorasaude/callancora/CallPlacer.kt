package br.com.ancorasaude.callancora

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager

/** Único lugar que chama TelecomManager.placeCall. Sem o papel de discador, não disca. */
object CallPlacer {

    /** Disca. Devolve null se deu certo, ou a mensagem do problema. */
    fun place(context: Context, number: String, scenario: String): String? {
        val clean = number.filter { it.isDigit() || it == '+' }
        if (clean.count(Char::isDigit) < 3) return "Número inválido."
        if (!Readiness.canDial(context)) {
            return "O celular ainda não está pronto: falta o discador padrão ou a permissão de ligação."
        }
        SignalMonitor.start(context)
        if (!SignalMonitor.inService) return SignalMonitor.status.value.message + "."
        val telecom = context.getSystemService(TelecomManager::class.java)
            ?: return "Serviço de telefonia indisponível."
        // Marca o início antes de discar: a chamada pode chegar ao serviço em poucos ms.
        CallBus.markDialRequested(clean, scenario)
        return try {
            telecom.placeCall(Uri.fromParts("tel", clean, null), Bundle())
            null
        } catch (e: SecurityException) {
            CallBus.note("Falha ao discar (permissão): ${e.message}")
            "O Android bloqueou a ligação. Confira as permissões."
        }
    }

    /** Há ligação em andamento (deste app ou de outro)? */
    fun phoneBusy(context: Context): Boolean {
        if (CallBus.hasLiveCall()) return true
        val telecom = context.getSystemService(TelecomManager::class.java) ?: return false
        return try {
            telecom.isInCall
        } catch (e: SecurityException) {
            false
        }
    }
}
