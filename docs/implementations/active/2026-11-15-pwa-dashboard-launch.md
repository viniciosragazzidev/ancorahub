# Inicialização do PWA no dashboard

**Status:** implementação, build e envio da branch concluídos; validação de abertura em PWA/dispositivo pendente porque o preview 3005 não responde.
**Prioridade:** solicitação explícita do Vinicios antes do envio da branch de assets.

## Comportamento acordado

- PWA instalado inicia em `/dashboard` pelo `start_url` do manifesto.
- Caso uma instalação existente ainda abra `/`, a landing detecta `standalone`, `window-controls-overlay` ou o modo de tela inicial do iOS e segue para `/dashboard`.
- No navegador comum, `/` continua sendo a landing page.
- O dashboard continua resolvendo sessão, tenant e papel no servidor; a mudança não contorna autenticação nem permissões.

## Arquivos e escopo

- `src/app/manifest.ts`: direciona a abertura do PWA instalado ao dashboard.
- `src/app/page.tsx`: fallback de redirecionamento para instalações que ainda iniciam na raiz.
- `docs/features-log.md`: registra o comportamento.

Não altera landing no navegador comum, fluxo de login, atalhos do manifesto, service worker, identidade do app ou acesso por tenant. Não adiciona dependência, flag, permissão ou dado persistido.

## Validação

- Documentação local do Next.js consultada: guia de PWA e referência do manifesto em `node_modules/next/dist/docs/`.
- A rota `/dashboard` usa `getRequiredTenantContext`; a autenticação e o escopo permanecem na implementação existente.
- `npx eslint src/app/page.tsx src/app/manifest.ts`: passou.
- `npm run agent:docs`: passou, com 23 referências verificadas; `git diff --check`: passou.
- `npm run build`: Turbopack parou antes de compilar porque rejeitou o symlink compartilhado de `node_modules` do worktree. `npm run build -- --webpack`: passou, incluindo TypeScript e 170 páginas estáticas; houve avisos não fatais já existentes em `unpdf` e nas rotas dinâmicas que leem `headers`.
- O manifesto compilado em `.next/server/app/manifest.webmanifest.body` confirma `"start_url":"/dashboard"`.
- A suíte de testes não foi executada. A validação real de instalação/abertura PWA depende do preview 3005 responder; na revisão anterior, a porta tinha processo escutando, mas a página não respondeu após 30 segundos.
- A branch `codex/mascote-assets` foi enviada ao `origin` no commit `f6da46f6`. Após sincronizar o preview, `/` e `/manifest.webmanifest` continuam sem resposta (HTTP 000 após 7 segundos); o servidor não foi reiniciado.

## Rollback

Reverter `start_url` para `/` e remover o efeito de detecção PWA em `src/app/page.tsx`.
