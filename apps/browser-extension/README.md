# CorreTop Assistant

Workspace MV3 do MVP. O content script é limitado a `web.whatsapp.com`, monta o painel em Shadow DOM e só envia ao gateway o telefone normalizado da conversa ativa. A decisão de acesso permanece no backend.

## Desenvolvimento

O workspace usa TypeScript/React e deve ser empacotado com Vite em uma etapa de CI autorizada. O diretório `dist/` é gerado e não contém segredos. A extensão nunca chama o CRM com `tenantId`, `userId` ou `branchId` fornecidos pelo cliente.

Fluxo manual: baixar em `/settings`, instalar no Chrome e gerar um código temporário no CRM para conectar o dispositivo. O token é guardado em `chrome.storage.session`, nunca em `localStorage` da página. A interface do WhatsApp permanece silenciosa até que o número visível corresponda a um lead atribuído ao usuário autenticado na mesma unidade.
