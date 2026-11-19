package br.com.ancorasaude.callancora

import android.text.Editable
import android.text.TextWatcher
import android.widget.EditText

/** Formatação de telefone brasileiro: (21) 99999-0000. */
object Phone {

    /** Formata enquanto a pessoa digita (até 11 dígitos). */
    fun formatPartial(digits: String): String {
        val d = digits.take(11)
        if (d.isEmpty()) return ""
        if (d.length <= 2) return "($d"
        val ddd = d.take(2)
        val rest = d.drop(2)
        val split = if (d.length == 11) 5 else 4
        return if (rest.length <= split) {
            "($ddd) $rest"
        } else {
            "($ddd) ${rest.take(split)}-${rest.drop(split)}"
        }
    }

    /** Formata um número completo para exibir (tela de chamada). Se não reconhecer, devolve como veio. */
    fun display(raw: String): String {
        var d = raw.filter { it.isDigit() }
        if ((d.length == 12 || d.length == 13) && d.startsWith("55")) d = d.drop(2)
        return when (d.length) {
            10, 11 -> formatPartial(d)
            8 -> "${d.take(4)}-${d.drop(4)}"
            9 -> "${d.take(5)}-${d.drop(5)}"
            else -> raw
        }
    }
}

/** Aplica [Phone.formatPartial] no campo. Números com "+" ficam como foram digitados. */
class BrPhoneWatcher(private val field: EditText) : TextWatcher {
    private var selfChange = false

    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

    override fun afterTextChanged(s: Editable?) {
        if (selfChange || s == null) return
        val raw = s.toString()
        if (raw.startsWith("+")) return
        val formatted = Phone.formatPartial(raw.filter { it.isDigit() })
        if (formatted == raw) return
        selfChange = true
        field.setText(formatted)
        field.setSelection(formatted.length)
        selfChange = false
    }
}
