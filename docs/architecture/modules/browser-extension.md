# Módulo AncoraHub Assistant

A extensão MV3 é um consumidor contextual do CRM no WhatsApp Web. Detecta apenas a conversa aberta, envia telefone normalizado e recebe um resumo minimizado quando o backend autoriza tenant, unidade e atribuição individual. A interface só é montada para um lead atribuído ao usuário autenticado na mesma unidade; `FORBIDDEN`, `NOT_FOUND` e conversa sem número não exibem painel nem mensagem na página. Inserir texto nunca envia mensagem.

O adaptador centraliza os seletores estáveis de WhatsApp Web (`wa-web-main-screen`, `conversation-panel-wrapper`, `conversation-header`, `drawer-right` e `conversation-compose-box-input`). Ele nunca clica para revelar dados: só usa o número já visível no cabeçalho ou no painel de contato aberto pelo próprio corretor. O painel é isolado por Shadow DOM e anexado a `drawer-right`, preservando o compositor de mensagens.

Consulte `apps/browser-extension`, `src/features/browser-extension`, `CONTEXT.md` e `docs/agent/SECURITY_RULES.md`. Mudanças exigem testes de FORBIDDEN/NOT_FOUND, sessão revogada, conflito de versão e ausência de envio automático.
