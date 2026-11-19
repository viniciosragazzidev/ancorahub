package br.com.ancorasaude.callancora

import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
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
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.ColorRes
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.materialswitch.MaterialSwitch
import kotlinx.coroutines.launch

/**
 * Tela da prova: prepara o celular (checklist), monta a fila de teste, liga e mostra,
 * ao vivo, cada estado que a operadora/Android informou.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var heroCard: View
    private lateinit var readinessList: LinearLayout
    private lateinit var btnNextItem: TextView
    private lateinit var chipStatus: TextView
    private lateinit var etNumber: EditText
    private lateinit var scenarioSection: View
    private lateinit var scenarioChips: List<TextView>
    private lateinit var etQueue: EditText
    private lateinit var tvQueueCount: TextView
    private lateinit var queueList: LinearLayout
    private lateinit var swAuto: MaterialSwitch
    private lateinit var btnCall: View
    private lateinit var tvCallLabel: TextView
    private lateinit var sessionCard: View
    private lateinit var sessionDot: View
    private lateinit var tvSessionTitle: TextView
    private lateinit var tvSessionDetail: TextView
    private lateinit var tvSessionStats: TextView
    private lateinit var btnSessionToggle: TextView
    private lateinit var btnSessionEnd: View
    private lateinit var lastCallHeader: View
    private lateinit var tvSeeAll: TextView
    private lateinit var timelineCard: LinearLayout
    private lateinit var emptyCard: View
    private lateinit var logActions: View

    /** Cenário escolhido nas pílulas; vai para o registro junto do pedido de ligação. */
    private var selectedScenario: String = ""

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        heroCard = findViewById(R.id.heroCard)
        readinessList = findViewById(R.id.readinessList)
        btnNextItem = findViewById(R.id.btnRole)
        chipStatus = findViewById(R.id.chipStatus)
        etNumber = findViewById(R.id.etNumber)
        scenarioSection = findViewById(R.id.scenarioSection)
        etQueue = findViewById(R.id.etQueue)
        tvQueueCount = findViewById(R.id.tvQueueCount)
        queueList = findViewById(R.id.queueList)
        swAuto = findViewById(R.id.swAuto)
        btnCall = findViewById(R.id.btnCall)
        tvCallLabel = findViewById(R.id.tvCallLabel)
        sessionCard = findViewById(R.id.sessionCard)
        sessionDot = findViewById(R.id.sessionDot)
        tvSessionTitle = findViewById(R.id.tvSessionTitle)
        tvSessionDetail = findViewById(R.id.tvSessionDetail)
        tvSessionStats = findViewById(R.id.tvSessionStats)
        btnSessionToggle = findViewById(R.id.btnSessionToggle)
        btnSessionEnd = findViewById(R.id.btnSessionEnd)
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

        AppFonts.applyTree(findViewById(android.R.id.content))
        etNumber.addTextChangedListener(BrPhoneWatcher(etNumber))

        btnNextItem.setOnClickListener {
            Readiness.missing(this).firstOrNull()?.let { requestItem(it) }
        }
        btnCall.setOnClickListener { onCallClicked() }
        findViewById<View>(R.id.btnCopy).setOnClickListener { copyLog() }
        findViewById<View>(R.id.btnShare).setOnClickListener { shareLog() }
        findViewById<View>(R.id.btnQueueAdd).setOnClickListener { addToQueue() }
        findViewById<View>(R.id.btnQueueClear).setOnClickListener { LocalQueueSource.clear() }
        tvSeeAll.setOnClickListener { showFullLog() }
        scenarioChips.forEach { chip -> chip.setOnClickListener { onScenarioClicked(chip) } }

        swAuto.isChecked = AutoDialer.autoEnabled.value
        swAuto.setOnCheckedChangeListener { _, checked -> AutoDialer.setAutoEnabled(checked) }

        btnSessionToggle.setOnClickListener { onSessionToggle() }
        btnSessionEnd.setOnClickListener { toast("Segure o botão para encerrar a sessão.") }
        btnSessionEnd.setOnLongClickListener {
            AutoDialer.endSession()
            true
        }

        handleDialIntent(intent)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { CallBus.log.collect { renderLog(it) } }
                launch { LocalQueueSource.items.collect { renderQueue(it) } }
                launch { AutoDialer.state.collect { renderSession() } }
                launch { AutoDialer.stats.collect { renderSession() } }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDialIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        refreshAll()
    }

    /** Outro app pediu para discar (ACTION_DIAL / VIEW tel:): só preenche o número. */
    private fun handleDialIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "tel") {
            etNumber.setText(data.schemeSpecificPart.orEmpty())
        }
    }

    private fun refreshAll() {
        renderReadiness()
        renderCallButton()
        renderSession()
    }

    // ---------- Preparar o celular ----------

    private fun renderReadiness() {
        val statuses = Readiness.check(this)
        val missing = statuses.count { !it.ok }
        val ready = missing == 0

        heroCard.visibility = if (ready) View.GONE else View.VISIBLE
        scenarioSection.visibility = if (ready) View.VISIBLE else View.GONE
        if (ready) {
            chipStatus.text = "✓ Celular pronto para ligar"
            chipStatus.setBackgroundResource(R.drawable.bg_chip_ok)
            chipStatus.setTextColor(color(R.color.forest))
        } else {
            chipStatus.text = if (missing == 1) "● Falta liberar 1 item" else "● Falta liberar $missing itens"
            chipStatus.setBackgroundResource(R.drawable.bg_chip_warn)
            chipStatus.setTextColor(color(R.color.amber_ink))
        }

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
            text = status.item.label
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

        if (!status.ok) {
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

    private fun actionLabel(item: Readiness.Item): String = when (item) {
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

    // ---------- Cenário ----------

    private fun onScenarioClicked(chip: TextView) {
        val turnOn = !chip.isSelected
        scenarioChips.forEach { it.isSelected = false }
        chip.isSelected = turnOn
        selectedScenario = if (turnOn) chip.text.toString() else ""
    }

    // ---------- Fila de teste ----------

    private fun addToQueue() {
        var numbers = LocalQueueSource.parse(etQueue.text?.toString().orEmpty())
        if (numbers.isEmpty()) {
            // Campo da fila vazio: usa o número digitado acima.
            numbers = listOf(etNumber.text?.toString().orEmpty()).filter { it.isNotBlank() }
        }
        if (numbers.isEmpty()) {
            toast("Digite ou cole pelo menos um número.")
            return
        }
        val before = LocalQueueSource.remaining()
        LocalQueueSource.addAll(numbers)
        val added = LocalQueueSource.remaining() - before
        if (added == 0) toast("Nenhum número válido.") else etQueue.setText("")
    }

    private fun renderQueue(items: List<QueueNumber>) {
        tvQueueCount.text = when (items.size) {
            0 -> "vazia"
            1 -> "1 número"
            else -> "${items.size} números"
        }
        queueList.removeAllViews()
        items.forEach { item ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(6), 0, dp(6))
            }
            val number = TextView(this).apply {
                text = Phone.display(item.number)
                setTextColor(color(R.color.ink))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            }
            AppFonts.apply(number, AppFonts.Kind.MEDIUM)
            row.addView(number, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            val remove = TextView(this).apply {
                text = "Remover"
                setTextColor(color(R.color.fog))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                setPadding(dp(8), dp(4), dp(4), dp(4))
                isClickable = true
                isFocusable = true
                setOnClickListener { LocalQueueSource.remove(item.id) }
            }
            AppFonts.apply(remove, AppFonts.Kind.SEMIBOLD)
            row.addView(remove)
            queueList.addView(row)
        }
        renderCallButton()
    }

    // ---------- Ligar e sessão ----------

    private fun renderCallButton() {
        val ready = Readiness.allReady(this)
        val enabled = ready && !AutoDialer.isSessionActive
        btnCall.isEnabled = enabled
        btnCall.alpha = if (enabled) 1f else 0.4f
        val queued = LocalQueueSource.remaining()
        tvCallLabel.text = if (queued > 0) "Iniciar fila ($queued)" else "Ligar"
    }

    private fun onCallClicked() {
        // Bloqueio no código, não só visual: sem tudo liberado, nenhum placeCall.
        if (!Readiness.allReady(this)) {
            toast("Libere os itens de \"Preparar o celular\" antes de ligar.")
            refreshAll()
            return
        }
        if (AutoDialer.isSessionActive) {
            toast("Já existe uma sessão em andamento.")
            return
        }
        val error = if (LocalQueueSource.remaining() > 0) {
            AutoDialer.start(this, selectedScenario)
        } else {
            val number = etNumber.text?.toString().orEmpty()
            if (number.isBlank()) "Digite um número ou monte a fila." else CallPlacer.place(this, number, selectedScenario)
        }
        error?.let { toast(it) }
        renderCallButton()
    }

    private fun onSessionToggle() {
        when (AutoDialer.state.value) {
            is AutoDialer.State.Paused -> AutoDialer.resume()
            is AutoDialer.State.Finished -> AutoDialer.dismiss()
            is AutoDialer.State.Calling, is AutoDialer.State.Countdown -> AutoDialer.pauseByUser()
            AutoDialer.State.Idle -> Unit
        }
    }

    private fun renderSession() {
        val state = AutoDialer.state.value
        val stats = AutoDialer.stats.value
        renderCallButton()
        if (state is AutoDialer.State.Idle) {
            sessionCard.visibility = View.GONE
            return
        }
        sessionCard.visibility = View.VISIBLE
        val remaining = AutoDialer.source.remaining()
        val queueText = remaining?.let { if (it == 1) "1 na fila" else "$it na fila" }
        val (title, dot, detail) = when (state) {
            is AutoDialer.State.Calling -> Triple(
                "Sessão em andamento",
                R.color.ancora_green,
                listOfNotNull("Ligando para ${Phone.display(state.item.number)}", queueText).joinToString(" · "),
            )
            is AutoDialer.State.Countdown -> Triple(
                "Próxima ligação em ${state.secondsLeft}…",
                R.color.ancora_blue,
                listOfNotNull(Phone.display(state.next.number), queueText).joinToString(" · "),
            )
            is AutoDialer.State.Paused -> Triple("Fila pausada", R.color.ancora_gold, state.reason)
            is AutoDialer.State.Finished -> Triple(
                if (state.endedByUser) "Sessão encerrada" else "Fila concluída",
                R.color.dot_neutral,
                "",
            )
            AutoDialer.State.Idle -> Triple("", R.color.dot_neutral, "")
        }
        tvSessionTitle.text = title
        sessionDot.backgroundTintList = ColorStateList.valueOf(color(dot))
        tvSessionDetail.text = detail
        tvSessionDetail.visibility = if (detail.isEmpty()) View.GONE else View.VISIBLE
        tvSessionStats.text = statsText(stats)
        btnSessionToggle.text = when (state) {
            is AutoDialer.State.Paused -> "Continuar"
            is AutoDialer.State.Finished -> "Fechar"
            else -> "Pausar"
        }
        btnSessionEnd.visibility = if (state is AutoDialer.State.Finished) View.GONE else View.VISIBLE
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
                    View(this).apply { setBackgroundColor(color(R.color.mist)) },
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
            backgroundTintList = ColorStateList.valueOf(color(item.dotColor))
        }
        row.addView(dot, LinearLayout.LayoutParams(dp(9), dp(9)).apply { topMargin = dp(5) })

        val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(this).apply {
            text = item.title
            setTextColor(color(R.color.ink))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }
        AppFonts.apply(title, AppFonts.Kind.SEMIBOLD)
        texts.addView(title)
        if (item.subtitle.isNotEmpty()) {
            val subtitle = TextView(this).apply {
                text = item.subtitle
                setTextColor(color(R.color.fog))
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
                setTextColor(color(R.color.steel))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                typeface = Typeface.MONOSPACE
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
