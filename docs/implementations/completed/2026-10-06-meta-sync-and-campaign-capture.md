# Sincronização Meta e herança da captura por campanha

## Entrega

- A sincronização deixou de percorrer campanha → conjunto → anúncio em chamadas aninhadas. Agora lê campanhas, conjuntos e anúncios em páginas por conta e associa cada anúncio ao conjunto e à campanha recebidos pela Meta.
- O CRM persiste `effective_status` da Meta e a interface identifica esse estado como veiculação externa, separado da captura CRM.
- Uma campanha com captura ativa autoriza seus anúncios e formulários atribuídos, mesmo que exista uma regra filha antiga desativada. Regras filhas ativas podem escolher uma fila mais específica. Formulário compartilhado não recebe autorização global.
- Se o webhook omitir `campaign_id`, o intake recupera a campanha pela relação anúncio → conjunto sincronizada, limitada ao tenant.
- Gestão autorizada pode consultar o motivo seguro da falha de sincronização.
- Regra registrada em BR-076/DEC-134; roadmap N72 atualizado.

## Segurança e comportamento

As consultas de recuperação usam o tenant obtido da fonte autenticada do webhook. A captura não altera status nem orçamento na Meta. O modo global `disabled` continua funcionando como bloqueio administrativo. Erros de limite da API continuam registrados; a leitura por conta reduz a quantidade de chamadas sequenciais.

## Validação

- `node node_modules/next/dist/bin/next build` — passou: compilação otimizada, TypeScript e geração das 86 páginas concluídos em 06/10/2026.
- `git diff --check` — passou.
- Testes automatizados não foram executados, conforme orientação do solicitante para não adicionar ou executar testes sem pedido.
- `npm run agent:context` não pôde ser executado: o shim global aponta para um `npm-cli.js` ausente. O contexto foi carregado manualmente conforme `.agent/context-manifest.json`.

## Operação e rollback

Depois de publicar, executar uma sincronização Meta para renovar status e espelhos de anúncios existentes. A fila só recebe leads novos após a publicação e a próxima entrega ou reprocessamento do webhook; nenhuma sincronização foi disparada em produção durante esta implementação.

Rollback: restaurar os arquivos listados no diff deste registro, a regra BR-076/DEC-134 e a atualização N72. A operação não requer migration.
