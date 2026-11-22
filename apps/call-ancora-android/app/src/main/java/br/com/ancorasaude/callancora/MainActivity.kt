package br.com.ancorasaude.callancora

import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.ColorRes
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.launch

/**
 * Tela única do Call Âncora: conectar por QR, boas-vindas, preparar o celular (se faltar
 * algo) e as ligações. As telas em si ficam em [CrmPanel]; aqui ficam permissões e o QR.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var readinessList: LinearLayout
    private lateinit var btnNextItem: TextView
    private lateinit var crmPanel: CrmPanel

    private val prefs by lazy { getSharedPreferences("call_ancora", Context.MODE_PRIVATE) }

    private val roleLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            refreshAll()
            if (!Readiness.isDefaultDialer(this)) {
                CallBus.note("Pedido para virar discador padrão recusado ou cancelado.")
            }
        }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { refreshAll() }

    /** Câmera só para ler o QR de pareamento. */
    private val cameraLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                launchScanner()
            } else {
                crmPanel.pairError = "Sem a câmera não dá para ler o QR. Toque de novo para permitir."
                crmPanel.render()
            }
        }

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val text = result.contents ?: return@registerForActivityResult
        lifecycleScope.launch {
            crmPanel.pairError = null
            val error = CrmSession.pairFromQr(this@MainActivity, text)
            crmPanel.pairError = error
            crmPanel.render()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        readinessList = findViewById(R.id.readinessList)
        btnNextItem = findViewById(R.id.btnRole)

        crmPanel = CrmPanel(this)
        crmPanel.bind()

        AppFonts.applyTree(findViewById(android.R.id.content))
        SignalMonitor.start(this)
        CrmSession.restore(this)
        // Regras de desligamento automático: valores guardados (padrão de fábrica), sem tela aqui.
        HangupSettings.load(this)

        btnNextItem.setOnClickListener {
            Readiness.missing(this).firstOrNull()?.let { requestItem(it) }
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { SignalMonitor.status.collect { refreshAll() } }
                launch { CrmSession.ui.collect { crmPanel.render() } }
                launch { CallBus.current.collect { crmPanel.render() } }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshAll()
    }

    override fun onStart() {
        super.onStart()
        CrmSession.foreground = true
    }

    override fun onStop() {
        CrmSession.foreground = false
        super.onStop()
    }

    /** "Ler QR code": pede a câmera (só agora) e abre o leitor. */
    fun startQrScan() {
        val permission = android.Manifest.permission.CAMERA
        when {
            ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED -> launchScanner()
            isPermanentlyDenied(permission) -> openAppSettings()
            else -> {
                prefs.edit().putBoolean("asked_$permission", true).apply()
                cameraLauncher.launch(permission)
            }
        }
    }

    private fun launchScanner() {
        scanLauncher.launch(
            ScanOptions()
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt("Aponte para o QR do Call Âncora na tela do computador")
                .setBeepEnabled(false)
                .setOrientationLocked(false),
        )
    }

    private fun refreshAll() {
        renderReadiness()
        if (::crmPanel.isInitialized) crmPanel.render()
    }

    // ---------- Preparar o celular ----------

    private fun renderReadiness() {
        val statuses = Readiness.check(this)
        readinessList.removeAllViews()
        statuses.forEachIndexed { index, status ->
            if (index > 0) {
                readinessList.addView(
                    View(this).apply { setBackgroundColor(color(R.color.white_12)) },
                    LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)),
                )
            }
            readinessList.addView(readinessRow(status))
        }
    }

    private fun readinessRow(status: Readiness.Status): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(9), 0, dp(9))
        }
        val mark = TextView(this).apply {
            gravity = Gravity.CENTER
            setBackgroundResource(R.drawable.bg_dot)
            backgroundTintList = ColorStateList.valueOf(color(if (status.ok) R.color.ancora_lime else R.color.white_12))
            text = if (status.ok) "✓" else ""
            setTextColor(color(R.color.ancora_navy))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
        }
        row.addView(mark, LinearLayout.LayoutParams(dp(22), dp(22)))

        val label = TextView(this).apply {
            text = if (status.item == Readiness.Item.SIGNAL && !status.ok) {
                SignalMonitor.status.value.message
            } else {
                status.item.label
            }
            setTextColor(color(R.color.white))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            alpha = if (status.ok) 0.75f else 1f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }
        AppFonts.apply(label, AppFonts.Kind.MEDIUM)
        row.addView(
            label,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dp(10) },
        )

        if (!status.ok && actionLabel(status.item) != null) {
            val button = TextView(this).apply {
                text = actionLabel(status.item)
                gravity = Gravity.CENTER
                setBackgroundResource(R.drawable.bg_pill_white)
                setTextColor(color(R.color.ancora_navy))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                setPadding(dp(14), 0, dp(14), dp(2))
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                isClickable = true
                isFocusable = true
                setOnClickListener { requestItem(status.item) }
            }
            AppFonts.apply(button, AppFonts.Kind.SEMIBOLD)
            row.addView(
                button,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(32)).apply { marginStart = dp(8) },
            )
        }
        return row
    }

    /** Texto do botão do item; null quando não há o que o app possa abrir. */
    private fun actionLabel(item: Readiness.Item): String? = when (item) {
        Readiness.Item.SIGNAL ->
            if (SignalMonitor.status.value == SignalMonitor.Status.AIRPLANE) "Abrir ajustes" else null
        Readiness.Item.DIALER_ROLE -> "Tornar padrão"
        Readiness.Item.FULL_SCREEN -> "Abrir ajustes"
        Readiness.Item.IN_CALL_SERVICE -> "Ativar"
        else -> {
            val permission = Readiness.permissionFor(item)
            if (permission != null && isPermanentlyDenied(permission)) "Abrir ajustes" else "Permitir"
        }
    }

    /** Pede o item do jeito certo; permissão negada de vez abre os ajustes do app. */
    private fun requestItem(item: Readiness.Item) {
        when (item) {
            Readiness.Item.DIALER_ROLE -> requestDialerRole()
            Readiness.Item.CALL_PHONE, Readiness.Item.READ_PHONE_STATE, Readiness.Item.NOTIFICATIONS -> {
                val permission = Readiness.permissionFor(item) ?: return
                if (isPermanentlyDenied(permission)) {
                    openAppSettings()
                } else {
                    prefs.edit().putBoolean("asked_$permission", true).apply()
                    permissionLauncher.launch(permission)
                }
            }
            Readiness.Item.FULL_SCREEN -> openFullScreenSettings()
            Readiness.Item.IN_CALL_SERVICE -> {
                Readiness.enableInCallService(this)
                refreshAll()
            }
            Readiness.Item.SIGNAL -> {
                if (SignalMonitor.status.value == SignalMonitor.Status.AIRPLANE) {
                    try {
                        startActivity(Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS))
                    } catch (e: ActivityNotFoundException) {
                        toast(SignalMonitor.status.value.message)
                    }
                } else {
                    toast(SignalMonitor.status.value.message + ". Procure um lugar com sinal.")
                }
            }
        }
    }

    private fun isPermanentlyDenied(permission: String): Boolean {
        val granted = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
        return !granted &&
            prefs.getBoolean("asked_$permission", false) &&
            !shouldShowRequestPermissionRationale(permission)
    }

    private fun requestDialerRole() {
        val roleManager = getSystemService(RoleManager::class.java)
        if (roleManager == null || !roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
            toast("Este aparelho não oferece a troca de discador padrão.")
            return
        }
        if (roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
            refreshAll()
            return
        }
        roleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER))
    }

    private fun openAppSettings() {
        startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)),
        )
    }

    private fun openFullScreenSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        try {
            startActivity(
                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.fromParts("package", packageName, null)),
            )
        } catch (e: ActivityNotFoundException) {
            openAppSettings()
        }
    }

    private fun color(@ColorRes id: Int): Int = ContextCompat.getColor(this, id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    companion object {
        /** "5 ligações · 3 atendidas · 02:41 em ligação (média 00:54)". */
        fun statsText(stats: AutoDialer.Stats): String {
            val calls = if (stats.total == 1) "1 ligação" else "${stats.total} ligações"
            val answered = if (stats.answered == 1) "1 atendida" else "${stats.answered} atendidas"
            val talk = "${Labels.clock(stats.talkMsTotal)} em ligação"
            val avg = if (stats.answered > 0) " (média ${Labels.clock(stats.talkMsAverage)})" else ""
            return "$calls · $answered · $talk$avg"
        }
    }
}
