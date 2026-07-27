# CorreTop Assistant

Workspace MV3 do MVP. O content script é limitado a `web.whatsapp.com`, monta o painel em Shadow DOM e só envia ao gateway o telefone normalizado da conversa ativa. A decisão de acesso permanece no backend.

## Desenvolvimento

O workspace usa TypeScript/React e deve ser empacotado com Vite em uma etapa de CI autorizada. O diretório `dist/` é gerado e não contém segredos. A extensão nunca chama o CRM com `tenantId`, `userId` ou `branchId` fornecidos pelo cliente.

Fluxo manual: habilitar em `/settings/extension`, gerar código temporário e informar o código no popup. O token é guardado em `chrome.storage.session`, nunca em `localStorage` da página.
