package br.com.ancorasaude.callancora

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Um número a ligar, com o cenário esperado (opcional). */
data class QueueNumber(
    val id: Long,
    val number: String,
    val scenario: String? = null,
    /** Id do contato na fonte externa (CRM). */
    val externalId: String? = null,
)

/**
 * De onde vêm os números da sessão de ligações.
 *
 * Hoje: [LocalQueueSource], a fila de teste digitada no celular.
 * Etapa 2: `CrmQueueSource`, que pareia com a web por QR e pede o próximo número em
 * `/api/call-ancora` (com reserva no servidor). Por isso as funções são `suspend`.
 */
interface NumberSource {
    /** Tira e devolve o próximo número, ou null se acabou. */
    suspend fun next(): QueueNumber?

    /** Devolve um número que foi tirado mas não chegou a ser discado (pausa, fim de sessão). */
    suspend fun returnToFront(item: QueueNumber)

    /** Quantos números ainda faltam, ou null se a fonte não souber dizer. */
    fun remaining(): Int?
}

/** Fila de teste local, só em memória. */
object LocalQueueSource : NumberSource {
    private var nextId = 1L
    private val _items = MutableStateFlow<List<QueueNumber>>(emptyList())
    val items: StateFlow<List<QueueNumber>> = _items.asStateFlow()

    /** Adiciona números (já limpos: dígitos e "+"). Ignora vazios e curtos demais. */
    fun addAll(numbers: List<String>) {
        val clean = numbers
            .map { raw -> raw.filter { it.isDigit() || it == '+' } }
            .filter { it.count(Char::isDigit) >= 3 }
        if (clean.isEmpty()) return
        _items.value = _items.value + clean.map { QueueNumber(nextId++, it) }
    }

    fun remove(id: Long) {
        _items.value = _items.value.filterNot { it.id == id }
    }

    fun clear() {
        _items.value = emptyList()
    }

    override suspend fun next(): QueueNumber? {
        val list = _items.value
        if (list.isEmpty()) return null
        _items.value = list.drop(1)
        return list.first()
    }

    override suspend fun returnToFront(item: QueueNumber) {
        _items.value = listOf(item) + _items.value
    }

    override fun remaining(): Int = _items.value.size

    /** Separa texto colado (um número por linha, ou por vírgula/ponto e vírgula). */
    fun parse(text: String): List<String> =
        text.split('\n', '\r', ',', ';').map { it.trim() }.filter { it.isNotEmpty() }
}
