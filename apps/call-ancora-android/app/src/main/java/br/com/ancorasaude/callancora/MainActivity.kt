package br.com.ancorasaude.callancora

import android.Manifest
import android.app.role.RoleManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

/**
 * Tela da prova: vira discador padrão, liga para um número digitado e mostra,
 * ao vivo, cada estado que a operadora/Android informou.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var tvDialerStatus: TextView
    private lateinit var btnRole: MaterialButton
    private lateinit var etNumber: TextInputEditText
    private lateinit var etScenario: TextInputEditText
    private lateinit var tvLog: TextView
    private lateinit var scroll: ScrollView

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

        tvDialerStatus = findViewById(R.id.tvDialerStatus)
        btnRole = findViewById(R.id.btnRole)
        etNumber = findViewById(R.id.etNumber)
        etScenario = findViewById(R.id.etScenario)
        tvLog = findViewById(R.id.tvLog)
        scroll = findViewById(R.id.scroll)

        btnRole.setOnClickListener { requestDialerRole() }
        findViewById<MaterialButton>(R.id.btnCall).setOnClickListener { onCallClicked() }
        findViewById<MaterialButton>(R.id.btnCopy).setOnClickListener { copyLog() }
        findViewById<MaterialButton>(R.id.btnShare).setOnClickListener { shareLog() }
        findViewById<MaterialButton>(R.id.btnClear).setOnClickListener { CallBus.clearLog() }

        handleDialIntent(intent)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                CallBus.log.collect { entries ->
                    tvLog.text = if (entries.isEmpty()) {
                        "Nenhuma ligação ainda. Faça um teste e os estados aparecem aqui."
                    } else {
                        entries.joinToString("\n") { CallBus.formatLine(it) }
                    }
                    scroll.post { scroll.fullScroll(ScrollView.FOCUS_DOWN) }
                }
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
        tvDialerStatus.text = if (isDefault) {
            "✓ Este app é o discador padrão. Os estados das ligações serão registrados."
        } else {
            "✗ Este app ainda NÃO é o discador padrão. Sem isso os estados não chegam."
        }
        tvDialerStatus.setBackgroundColor(
            ContextCompat.getColor(this, if (isDefault) R.color.ancora_green else R.color.hangup_red),
        )
        btnRole.isEnabled = !isDefault
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
        CallBus.markDialRequested(number, etScenario.text?.toString().orEmpty())
        try {
            telecom.placeCall(Uri.fromParts("tel", number, null), Bundle())
        } catch (e: SecurityException) {
            CallBus.note("Falha ao discar (permissão): ${e.message}")
            toast("O Android bloqueou a ligação. Confira a permissão de telefone.")
        }
    }

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

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
