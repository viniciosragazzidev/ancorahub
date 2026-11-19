package br.com.ancorasaude.callancora

import android.Manifest
import android.app.role.RoleManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

/**
 * Tela da prova: vira discador padrão, liga para um número digitado e mostra,
 * ao vivo, cada estado que a operadora/Android informou.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var heroCard: View
    private lateinit var btnRole: View
    private lateinit var chipStatus: TextView
    private lateinit var etNumber: EditText
    private lateinit var scenarioSection: View
    private lateinit var scenarioChips: List<TextView>
    private lateinit var btnCall: View
    private lateinit var lastCallHeader: View
    private lateinit var tvSeeAll: TextView
    private lateinit var timelineCard: LinearLayout
    private lateinit var emptyCard: View
    private lateinit var logActions: View

    /** Cenário escolhido nas pílulas; vai para o registro junto do pedido de ligação. */
    private var selectedScenario: String = ""

    private val roleLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            refreshDialerStatus()
            if (!isDefaultDialer()) {
                CallBus.note("Pedido para virar discador padrão recusado ou cancelado.")
            }
        }

    private val callPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                placeCall()
            } else {
                toast("Sem a permissão de ligação não dá para discar.")
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        heroCard = findViewById(R.id.heroCard)
        btnRole = findViewById(R.id.btnRole)
        chipStatus = findViewById(R.id.chipStatus)
        etNumber = findViewById(R.id.etNumber)
        scenarioSection = findViewById(R.id.scenarioSection)
        btnCall = findViewById(R.id.btnCall)
        lastCallHeader = findViewById(R.id.lastCallHeader)
        tvSeeAll = findViewById(R.id.tvSeeAll)
        timelineCard = findViewById(R.id.timelineCard)
        emptyCard = findViewById(R.id.emptyCard)
        logActions = findViewById(R.id.logActions)
        scenarioChips = listOf(
            R.id.scAtendida,
            R.id.scNaoAtende,
            R.id.scCaixaPostal,
            R.id.scOcupado,
            R.id.scDesliga,
        ).map { findViewById<TextView>(it) }

        // O mascote do cartão azul não passa das bordas arredondadas.
        heroCard.clipToOutline = true

        AppFonts.applyTree(findViewById(android.R.id.content))
        etNumber.addTextChangedListener(BrPhoneWatcher(etNumber))

        btnRole.setOnClickListener { requestDialerRole() }
        btnCall.setOnClickListener { onCallClicked() }
        findViewById<View>(R.id.btnCopy).setOnClickListener { copyLog() }
        findViewById<View>(R.id.btnShare).setOnClickListener { shareLog() }
        tvSeeAll.setOnClickListener { showFullLog() }
        scenarioChips.forEach { chip -> chip.setOnClickListener { onScenarioClicked(chip) } }

        handleDialIntent(intent)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                CallBus.log.collect { entries -> renderLog(entries) }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDialIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        refreshDialerStatus()
    }

    /** Outro app pediu para discar (ACTION_DIAL / VIEW tel:): só preenche o número. */
    private fun handleDialIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "tel") {
            etNumber.setText(data.schemeSpecificPart.orEmpty())
        }
    }

    // ---------- Discador padrão ----------

    private fun isDefaultDialer(): Boolean {
        val roleManager = getSystemService(RoleManager::class.java)
        if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
            return roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
        }
        val telecom = getSystemService(TelecomManager::class.java)
        return telecom?.defaultDialerPackage == packageName
    }

    private fun refreshDialerStatus() {
        val isDefault = isDefaultDialer()
        heroCard.visibility = if (isDefault) View.GONE else View.VISIBLE
        scenarioSection.visibility = if (isDefault) View.VISIBLE else View.GONE
        if (isDefault) {
            chipStatus.text = "✓ Discador padrão ativo"
            chipStatus.setBackgroundResource(R.drawable.bg_chip_ok)
            chipStatus.setTextColor(ContextCompat.getColor(this, R.color.forest))
        } else {
            chipStatus.text = "● Ainda não é o discador padrão"
            chipStatus.setBackgroundResource(R.drawable.bg_chip_warn)
            chipStatus.setTextColor(ContextCompat.getColor(this, R.color.amber_ink))
        }
        // Visual de desativado; o toque continua discando (com o aviso no registro), como antes.
        btnCall.alpha = if (isDefault) 1f else 0.4f
    }

    private fun requestDialerRole() {
        val roleManager = getSystemService(RoleManager::class.java)
        if (roleManager == null || !roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
            toast("Este aparelho não oferece a troca de discador padrão.")
            return
        }
        if (roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
            refreshDialerStatus()
            return
        }
        roleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER))
    }

    // ---------- Cenário ----------

    private fun onScenarioClicked(chip: TextView) {
        val turnOn = !chip.isSelected
        scenarioChips.forEach { it.isSelected = false }
        chip.isSelected = turnOn
        selectedScenario = if (turnOn) chip.text.toString() else ""
    }

    // ---------- Ligar ----------

    private fun onCallClicked() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            placeCall()
        } else {
            callPermissionLauncher.launch(Manifest.permission.CALL_PHONE)
        }
    }

    private fun placeCall() {
        val number = etNumber.text?.toString().orEmpty().filter { it.isDigit() || it == '+' }
        if (number.length < 3) {
            toast("Digite um número válido.")
            return
        }
        if (!isDefaultDialer()) {
            CallBus.note("App não é o discador padrão: a ligação sai, mas os estados não serão registrados.")
        }
        val telecom = getSystemService(TelecomManager::class.java)
        if (telecom == null) {
            toast("Serviço de telefonia indisponível.")
            return
        }
        // Marca o início antes de discar: a chamada pode chegar ao serviço em poucos ms.
        CallBus.markDialRequested(number, selectedScenario)
        try {
            telecom.placeCall(Uri.fromParts("tel", number, null), Bundle())
        } catch (e: SecurityException) {
            CallBus.note("Falha ao discar (permissão): ${e.message}")
            toast("O Android bloqueou a ligação. Confira a permissão de telefone.")
        }
    }

    // ---------- Linha do tempo ----------

    private fun renderLog(entries: List<LogEntry>) {
        val empty = entries.isEmpty()
        emptyCard.visibility = if (empty) View.VISIBLE else View.GONE
        lastCallHeader.visibility = if (empty) View.GONE else View.VISIBLE
        timelineCard.visibility = if (empty) View.GONE else View.VISIBLE
        logActions.visibility = if (empty) View.GONE else View.VISIBLE
        if (empty) return

        val count = Timeline.callCount(entries)
        tvSeeAll.text = "Ver todas ($count)"
        fillTimeline(timelineCard, Timeline.lastCall(entries))
    }

    private fun fillTimeline(container: LinearLayout, items: List<TimelineItem>) {
        container.removeAllViews()
        items.forEachIndexed { index, item ->
            container.addView(timelineRow(item))
            if (index < items.lastIndex) {
                container.addView(
                    View(this).apply {
                        setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.mist))
                    },
                    LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)),
                )
            }
        }
    }

    private fun timelineRow(item: TimelineItem): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(7), 0, dp(7))
        }

        val dot = View(this).apply {
            setBackgroundResource(R.drawable.bg_dot)
            backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this@MainActivity, item.dotColor))
        }
        row.addView(dot, LinearLayout.LayoutParams(dp(9), dp(9)).apply { topMargin = dp(5) })

        val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(this).apply {
            text = item.title
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.ink))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        }
        AppFonts.apply(title, AppFonts.Kind.SEMIBOLD)
        texts.addView(title)
        if (item.subtitle.isNotEmpty()) {
            val subtitle = TextView(this).apply {
                text = item.subtitle
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.fog))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f)
            }
            AppFonts.apply(subtitle, AppFonts.Kind.REGULAR)
            texts.addView(subtitle)
        }
        row.addView(
            texts,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dp(10) },
        )

        if (item.sinceDial.isNotEmpty()) {
            val ms = TextView(this).apply {
                text = item.sinceDial
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.steel))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                typeface = android.graphics.Typeface.MONOSPACE
            }
            AppFonts.apply(ms, AppFonts.Kind.MONO)
            row.addView(
                ms,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { marginStart = dp(8) },
            )
        }
        return row
    }

    /** "Ver todas": todas as etapas de todas as ligações, mais a opção de limpar. */
    private fun showFullLog() {
        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(8), dp(24), dp(8))
        }
        fillTimeline(list, Timeline.toItems(CallBus.log.value))
        val scroll = ScrollView(this).apply { addView(list) }
        MaterialAlertDialogBuilder(this)
            .setTitle("Todas as ligações")
            .setView(scroll)
            .setPositiveButton("Fechar", null)
            .setNeutralButton("Limpar registro") { _, _ -> CallBus.clearLog() }
            .show()
    }

    // ---------- Registro técnico (inalterado) ----------

    private fun copyLog() {
        val clipboard = getSystemService(ClipboardManager::class.java) ?: return
        clipboard.setPrimaryClip(ClipData.newPlainText("Registro Call Âncora", CallBus.formatLog(this)))
        toast("Registro copiado.")
    }

    private fun shareLog() {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Call Âncora: registro da prova do discador")
            putExtra(Intent.EXTRA_TEXT, CallBus.formatLog(this@MainActivity))
        }
        startActivity(Intent.createChooser(send, "Enviar registro"))
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
