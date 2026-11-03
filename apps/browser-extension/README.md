# AncoraHub Assistant

Workspace MV3 do MVP. O content script é limitado a `web.whatsapp.com`, monta o painel em Shadow DOM e só envia ao gateway o telefone normalizado da conversa ativa. A decisão de acesso permanece no backend.

## Desenvolvimento

O workspace usa TypeScript/React e deve ser empacotado com Vite em uma etapa de CI autorizada. O diretório `dist/` é gerado e não contém segredos. A extensão nunca chama o CRM com `tenantId`, `userId` ou `branchId` fornecidos pelo cliente.

Fluxo manual: baixar em `/settings`, instalar no Chrome e gerar um código temporário no CRM para conectar o dispositivo. O token é guardado em `chrome.storage.session`, nunca em `localStorage` da página. A interface do WhatsApp permanece silenciosa até que o número visível corresponda a um lead atribuído ao usuário autenticado na mesma unidade.

## Build (E0b)

- `CRM_BASE` define o endereço do CRM (padrão `https://crm.ancorasaude.cloud`). Só origem https, ou `http://localhost` em desenvolvimento. O mesmo valor vai para `host_permissions` do manifest gerado.
- `npm run build:extension` falha se algum bundle falhar. O `prebuild` usa `scripts/prebuild-extension.mjs`: em falha mantém o zip anterior e não derruba o build do site.
- Painel React: `src/panel/main.tsx` (IIFE, `panel/panel.js`). Não entra no script de conteúdo. A interface completa vem na E2.
- Detectores (`src/content/detectors.ts`): alternativas por capacidade em ordem (data-testid, depois aria-label PT e EN). Alvo único e visível, ou a capacidade some sem afetar as outras. As alternativas de `barraEsquerda` e `linhaChat` ainda não foram validadas contra HTML real: confirmar com captura sanitizada na E6. Fixtures em `src/content/fixtures/` são sintéticos.
- Tamanhos medidos (gzip): service worker + conteúdo 5,9 KB (limite 30 KB); painel com React 65,4 KB (limite 200 KB).
