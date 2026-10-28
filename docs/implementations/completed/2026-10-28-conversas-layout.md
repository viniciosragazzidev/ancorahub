# Ajuste de layout da central de conversas

Status: concluido em 28/10/2026.

## Escopo

Layout da rota `/conversas` em desktop e celular. Envio, filtros, navegacao, PDF, WhatsApp e permissoes existentes foram mantidos. Com a pele Lite desligada, a rota continua renderizando o markup anterior.

## O que mudou

- Removida a reserva generica de 96 px no rodape desta tela. O historico agora usa a altura disponivel e rola dentro do painel.
- Abas e filtros foram movidos para uma linha horizontal rolavel no topo da lista.
- O composer Lite virou uma area de texto que cresce ate 112 px. Enter envia; Shift+Enter quebra a linha. O placeholder curto cabe no celular.
- O composer da aba oficial com corretores usa o mesmo comportamento Lite. A entrada legada continua como `Input`.
- A previa de desenvolvimento ganhou uma fixture de corretor para capturas do AppShell real, sem dados pessoais.

## Arquivos e fluxos

- `src/app/(dashboard)/conversas/conversas-lite.module.css`
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx`
- `src/app/(dashboard)/conversas/conversations-skin.test.tsx`
- `src/app/dev/diretor-shell-real/page.tsx`, fixture somente de desenvolvimento

## Validacao

- `npx vitest run 'src/app/(dashboard)/conversas/conversations-skin.test.tsx' --maxWorkers=1`: 1 arquivo, 7 testes passaram. O snapshot legado nao precisou de atualizacao.
- `npx tsc --noEmit`: a execucao final encontrou erros de tipo em `src/features/ai-agent/city-before-hot.test.ts`, arquivo novo fora deste escopo e em edicao paralela. O arquivo nao foi alterado.
- ESLint dos arquivos tocados: 0 erros; 31 avisos, incluindo avisos preexistentes nos arquivos de Conversas e CSS ignorado pela configuracao.
- `node scripts/check-lite-skin.mjs`: executado em modo relatorio. O relatorio inclui desvios preexistentes na base e nos trechos legados.
- Build padrao via Turbopack falhou porque o junction `node_modules` aponta para fora da raiz do worktree. `npx next build --webpack` completou com avisos existentes de `unpdf` e de rotas dinamicas que usam `headers`.
- Nao foram executados testes `*.db.test.ts`, migracoes ou operacoes de banco.
- Capturas antes e depois em 1440x900 e 390x844: `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/conversas-prints/`.

## Evidencia visual e rollback

- Em 390 px, `document.body.scrollWidth` ficou em 390 px e a conversa usa rolagem propria. Em 1440 px, a lista ficou com 300 px minimos e o painel de conversa ganhou 96 px de altura.
- O rollback e reverter o commit local, que altera somente layout, teste, fixture de desenvolvimento e registros desta entrega.
