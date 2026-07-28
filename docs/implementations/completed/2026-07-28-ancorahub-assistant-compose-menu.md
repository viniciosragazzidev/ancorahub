# Menu contextual do AncoraHub Assistant — 28/07/2026

## Entrega

- O painel lateral fixo foi substituído por um ícone de âncora ao lado de “Anexar” no compositor do WhatsApp Web.
- O ícone só é inserido após a resolução de um lead autorizado e abre um menu compacto, visualmente alinhado ao menu de anexos nativo.
- O menu mostra nome, status, unidade e próxima ação, além de abrir o lead no CRM por uma nova aba criada pelo service worker.
- As ações “Pedir dado” e “Retomar conversa” chamam as sugestões controladas do CRM. A escolha só preenche o compositor; não envia mensagem.
- O menu usa o padrão dropdown com abertura/fechamento curta e suporte a `prefers-reduced-motion`.

## Validações

- Teste de montagem junto ao botão de anexo.
- Testes existentes de telefone e seleção do lead autorizado.
- `npm test` completo: 38 arquivos e 186 testes aprovados.
- `npm run type-check`, `npm run build:extension`, `npm run build` e `npm run agent:docs` aprovados.
