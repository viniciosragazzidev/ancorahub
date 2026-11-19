package br.com.ancorasaude.callancora

/**
 * Fila do CRM (sessão do corretor no AncoraHub). O servidor manda no avanço da fila:
 * o corretor classifica na web e o próximo contato aparece aqui.
 *
 * SEGURANÇA: só devolve número quando o servidor marcou o contato como discável
 * (base de frios ou lista de teste de admin/dev). Contato não discável nunca vira ligação.
 */
class CrmQueueSource(private val api: CrmApi) : NumberSource {

    /** Último estado lido do servidor. */
    @Volatile
    var latest: CrmState? = null
        private set

    /** Contato já entregue para discar (não entrega de novo). */
    private var handedOutId: String? = null

    /** Lê o estado e devolve o contato atual se ele estiver pronto e for discável. */
    override suspend fun next(): QueueNumber? {
        val state = api.state().also { latest = it }
        val contact = dialableReady(state) ?: return null
        if (contact.id == handedOutId) return null
        return QueueNumber(id = contact.id.hashCode().toLong(), number = contact.phone!!, externalId = contact.id)
    }

    /** O contato foi discado: não volta a ser entregue. */
    fun markDialed(item: QueueNumber) {
        handedOutId = item.externalId
    }

    /** Permite tentar de novo o mesmo contato (ex.: a ligação não chegou a começar). */
    override suspend fun returnToFront(item: QueueNumber) {
        if (item.externalId == handedOutId) handedOutId = null
    }

    fun allowRetry() {
        handedOutId = null
    }

    override fun remaining(): Int? = latest?.let { (it.total - it.completed).coerceAtLeast(0) }

    companion object {
        fun dialableReady(state: CrmState): CrmContact? {
            val contact = state.current ?: return null
            if (state.callStatus != "ready") return null
            if (!contact.dialable) return null
            val phone = contact.phone ?: return null
            if (phone.count(Char::isDigit) < 10) return null
            return contact
        }
    }
}
