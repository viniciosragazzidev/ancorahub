package br.com.ancorasaude.callancora

import android.content.Context
import android.graphics.Typeface
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.provider.FontRequest
import android.provider.FontsContract
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import java.lang.ref.WeakReference

/**
 * Fontes do Lite (Plus Jakarta Sans 400/500/600 e JetBrains Mono 500) baixadas pelo provedor
 * de fontes do Google Play Services, sem embutir arquivos no APK.
 *
 * Usa a API do próprio Android (FontsContract), que confia no Play Services por ser app do
 * sistema, então não precisa do arquivo de certificados. Enquanto a fonte não chega, ou se o
 * aparelho não tiver Play Services, fica a fonte do sistema definida no layout (sans-serif,
 * sans-serif-medium ou monospace).
 *
 * Nos layouts, android:tag escolhe a fonte: font400, font500, font600 ou mono.
 */
object AppFonts {
    enum class Kind(val tag: String, val family: String, val weight: Int) {
        REGULAR("font400", "Plus Jakarta Sans", 400),
        MEDIUM("font500", "Plus Jakarta Sans", 500),
        SEMIBOLD("font600", "Plus Jakarta Sans", 600),
        MONO("mono", "JetBrains Mono", 500),
    }

    private const val AUTHORITY = "com.google.android.gms.fonts"
    private const val PROVIDER_PACKAGE = "com.google.android.gms"

    private val main = Handler(Looper.getMainLooper())
    private val worker: Handler by lazy {
        val thread = HandlerThread("call-ancora-fonts").apply { start() }
        Handler(thread.looper)
    }

    // Só acessados na thread principal.
    private val loaded = HashMap<Kind, Typeface>()
    private val waiting = HashMap<Kind, MutableList<WeakReference<TextView>>>()
    private val requested = HashSet<Kind>()

    /** Percorre a árvore e aplica a fonte de cada TextView marcado com tag. */
    fun applyTree(view: View) {
        if (view is TextView) {
            kindFor(view.tag)?.let { apply(view, it) }
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) applyTree(view.getChildAt(i))
        }
    }

    fun apply(view: TextView, kind: Kind) {
        val typeface = loaded[kind]
        if (typeface != null) {
            view.typeface = typeface
            return
        }
        waiting.getOrPut(kind) { mutableListOf() }.add(WeakReference(view))
        request(view.context.applicationContext, kind)
    }

    private fun kindFor(tag: Any?): Kind? = Kind.entries.firstOrNull { it.tag == tag }

    private fun request(context: Context, kind: Kind) {
        if (!requested.add(kind)) return
        val query = "name=${kind.family}&weight=${kind.weight}"
        val fontRequest = FontRequest(AUTHORITY, PROVIDER_PACKAGE, query)
        val callback = object : FontsContract.FontRequestCallback() {
            override fun onTypefaceRetrieved(typeface: Typeface) {
                main.post {
                    loaded[kind] = typeface
                    waiting.remove(kind)?.forEach { ref -> ref.get()?.typeface = typeface }
                }
            }

            override fun onTypefaceRequestFailed(reason: Int) {
                // Fica a fonte do sistema. Não tenta de novo nesta execução.
                main.post { waiting.remove(kind) }
            }
        }
        try {
            FontsContract.requestFonts(context, fontRequest, worker, null, callback)
        } catch (e: RuntimeException) {
            waiting.remove(kind)
        }
    }
}
