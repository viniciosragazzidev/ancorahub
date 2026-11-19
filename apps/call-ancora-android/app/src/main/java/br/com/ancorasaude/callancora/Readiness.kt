package br.com.ancorasaude.callancora

import android.Manifest
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telecom.InCallService
import androidx.core.content.ContextCompat

/**
 * O que o celular precisa liberar para o Call Âncora discar e receber os estados.
 * A ordem da lista é a ordem em que os pedidos são feitos.
 */
object Readiness {

    enum class Item(val label: String) {
        DIALER_ROLE("Discador padrão do aparelho"),
        CALL_PHONE("Fazer ligações"),
        READ_PHONE_STATE("Ler o estado do telefone"),
        NOTIFICATIONS("Mostrar a notificação da ligação"),
        FULL_SCREEN("Abrir a chamada com o celular bloqueado"),
        IN_CALL_SERVICE("Serviço de chamadas do app"),
        SIGNAL("Sinal da operadora"),
    }

    data class Status(val item: Item, val ok: Boolean)

    /** Itens que valem para este Android, com a situação de cada um. */
    fun check(context: Context): List<Status> {
        SignalMonitor.start(context)
        return applicableItems().map { Status(it, isOk(context, it)) }
    }

    fun allReady(context: Context): Boolean = check(context).all { it.ok }

    fun missing(context: Context): List<Item> = check(context).filterNot { it.ok }.map { it.item }

    /** Mínimo para discar e receber estados: sem isso nenhum placeCall é feito. */
    fun canDial(context: Context): Boolean =
        isOk(context, Item.DIALER_ROLE) && isOk(context, Item.CALL_PHONE)

    fun applicableItems(): List<Item> = Item.entries.filter { item ->
        when (item) {
            Item.NOTIFICATIONS -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            Item.FULL_SCREEN -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            else -> true
        }
    }

    /** Permissão de tempo de execução de cada item, quando houver. */
    fun permissionFor(item: Item): String? = when (item) {
        Item.CALL_PHONE -> Manifest.permission.CALL_PHONE
        Item.READ_PHONE_STATE -> Manifest.permission.READ_PHONE_STATE
        Item.NOTIFICATIONS ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Manifest.permission.POST_NOTIFICATIONS else null
        else -> null
    }

    fun isOk(context: Context, item: Item): Boolean = when (item) {
        Item.DIALER_ROLE -> isDefaultDialer(context)
        Item.CALL_PHONE, Item.READ_PHONE_STATE, Item.NOTIFICATIONS -> {
            val permission = permissionFor(item)
            permission == null ||
                ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
        Item.FULL_SCREEN -> canUseFullScreenIntent(context)
        Item.IN_CALL_SERVICE -> isInCallServiceEnabled(context)
        Item.SIGNAL -> SignalMonitor.inService
    }

    fun isDefaultDialer(context: Context): Boolean {
        val roleManager = context.getSystemService(RoleManager::class.java) ?: return false
        return roleManager.isRoleAvailable(RoleManager.ROLE_DIALER) &&
            roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
    }

    fun canUseFullScreenIntent(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
        val nm = context.getSystemService(NotificationManager::class.java) ?: return false
        return nm.canUseFullScreenIntent()
    }

    fun inCallServiceComponent(context: Context) = ComponentName(context, CallService::class.java)

    /** O serviço está declarado, ligado, e o Android o encontra como InCallService. */
    fun isInCallServiceEnabled(context: Context): Boolean {
        val pm = context.packageManager
        val setting = pm.getComponentEnabledSetting(inCallServiceComponent(context))
        if (setting == PackageManager.COMPONENT_ENABLED_STATE_DISABLED ||
            setting == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER
        ) {
            return false
        }
        val intent = Intent(InCallService.SERVICE_INTERFACE).setPackage(context.packageName)
        return pm.queryIntentServices(intent, 0).isNotEmpty()
    }

    fun enableInCallService(context: Context) {
        context.packageManager.setComponentEnabledSetting(
            inCallServiceComponent(context),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP,
        )
    }
}
