# CorreTop Assistant — MVP

## Entregue nesta fase

- Fundação de sessão própria por dispositivo, código temporário iniciado pelo CRM e revogação persistível.
- Gateway `/api/extension/*` com resolução de lead escopada por tenant/unidade/carteira, configuração e operações de status, feedback e sugestões controladas.
- Workspace MV3 em `apps/browser-extension/`, com content script exclusivo do WhatsApp Web, MutationObserver com debounce, adaptador centralizado e painel isolado em Shadow DOM.
- Sugestões não enviam mensagens: a ação de inserção usa apenas o compositor e nunca simula Enter.

## Próximas fases

Empacotamento Vite/React em CI, integração do RAG autorizado e do gerador de sugestões existente, editor administrativo completo de políticas/status/campos, telemetry sem PII e testes de navegador com uma instalação real do WhatsApp Web. Até essa etapa, o backend mantém a capacidade reversível e o scaffold da extensão não deve ser distribuído como release final.
