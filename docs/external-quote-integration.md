# Cotação externa

O CorreTop não calcula a proposta comercial quando o cotador externo está configurado.
O botão do lead chama uma Server Action autenticada, valida tenant/filial/carteira,
registra `external_quote.opened` na auditoria e abre `EXTERNAL_QUOTE_APP_URL` com o
`leadId` como parâmetro.

Configure `EXTERNAL_QUOTE_APP_URL` nos ambientes Preview e Production da Vercel. O valor
deve ser uma URL `http` ou `https`. Sem essa variável, o botão permanece desabilitado e
explica que o cotador ainda não foi configurado.

Contrato mínimo do cotador externo: aceitar `leadId`, autenticar o usuário/tenant por sua
própria sessão ou gateway e devolver o resultado ao CRM por um contrato futuro aprovado.
Não inclua telefone, e-mail ou respostas de saúde na URL.
