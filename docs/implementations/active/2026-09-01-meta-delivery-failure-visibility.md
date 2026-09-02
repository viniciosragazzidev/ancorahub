# Diagnóstico de falha de entrega Meta no atendimento

## Objetivo

Expor ao Diretor, na mensagem que falhou, o motivo seguro devolvido pela Meta,
sem enviar payloads do provedor, telefones ou conteúdo de mensagens ao browser.

## Evidência da ocorrência

A consulta limitada aos três atendimentos reportados encontrou três mensagens
com `provider_status = failed`, sem registro correspondente no ledger de saída.
Os eventos de webhook correlatos contêm o código Meta `131042`.

## Escopo

- Correlacionar uma mensagem com falha ao evento de status Meta pelo identificador
  de mensagem, sempre validando o tenant através do canal de comunicação.
- Converter somente códigos estáveis em orientação segura para Diretor.
- Não alterar envio, template, cobrança, credenciais, RLS ou regras de IA.

## Risco e rollback

O dado exibido já existe no ledger de webhooks e continua restrito ao Diretor.
Reverter os arquivos desta entrega remove a explicação visual; não altera dados
nem configuração externa.
