# Diretor Lite F0a: fundação isolada

Status: concluído, com item 8 delegado ao Maestro

Base: `origin/feat/diretor-visual-lite` em `59cd3d55`.
Branch: `feat/diretor-lite-f0a`.
Worktree: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-diretor-f0a`.

## Escopo

Executar os itens 1 a 7 e 9 da fase F0a do plano
[`2026-10-24-diretor-lite-redesign.md`](./2026-10-24-diretor-lite-redesign.md).
O item 8, linha de base de desempenho que exige sessão autenticada em produção,
fica sob responsabilidade do Maestro.

## Entregas

- D0 registrado em DEC-149, `docs/design-system.md`, `CLAUDE.md`, `AGENTS.md` e
  `LITE_CHAT_DESIGN_SYSTEM.md`.
- Flag `feature_director_lite_style` por empresa, desligada por padrão e alterável
  pelo Super-admin com validação de tenant e registro de auditoria.
- A flag só é aplicada ao papel `director`. O tema claro é forçado no servidor e o
  seletor de tema fica oculto quando o piloto está ativo.
- Skin `director-skin.css`, provider React de escopo, wrappers de Portal/Popup,
  destino de portais motion, sucesso animado e toaster ficam isolados sob
  `.arc-venancor[data-skin="diretor"]`.
- A escala de texto 115% e 130% do Lite só alcança a raiz quando existe `.arc-venancor`;
  a preferência sozinha não muda a escala do CRM normal. O tema claro do Diretor
  depende apenas do papel e da flag, inclusive quando a página está em opt-out.
- Dialog, sheet, drawer, popover, menus, tooltip, command, combobox, motion e
  BottomSheet recebem classe e `data-skin` nos pontos flutuantes com provider ativo.
  O BottomSheet usa a raiz `director-lite-portal-root` do Diretor; sem provider,
  continua no `body` sem escopo.
- As 92 páginas atuais de `(dashboard)` ficam em opt-out até sua onda de revisão.
  Há teste que compara a lista com o filesystem.
- `/distribuicao` herda a proteção que bloqueia acesso de gestores.
- `scripts/check-lite-skin.mjs` produz somente um relatório de desvios nesta fase.

## Invariantes, reversão e limites

- Com a chave desligada, classes de skin e mudanças de aparência não são aplicadas.
- O controle por empresa permite desligar o piloto sem deploy. O fallback de leitura
  da flag é fechado, então falha de settings mantém o visual atual.
- Para reverter o piloto, o Super-admin desativa a chave da empresa. Os padrões de
  rota permanecem em opt-out até aprovação visual das próximas fases.
- Não copiar `.env.local`, rodar migrations ou testes de banco. Nenhum push.
- Não editar a base compartilhada de tokens do Lite. Os seletores de escala em
  `venancor-scope.css` ficam condicionados à existência do escopo Arc.

## Validações e commits

- `npx vitest run` nos testes focados de F0a: 7 arquivos e 19 testes passaram.
- `npx tsc --noEmit -p .`: passou.
- `npx eslint` nos arquivos TypeScript/TSX/MJS tocados: 0 erros e 43 avisos.
- `npm run check:lite-skin`: passou em modo relatório.
- `npm run agent:docs`: passou, com 18 referências verificadas.
- Diagnósticos do harness: 3 observações arquiteturais, 1 para revisar a origem
  do `tenantId` na ação de Super-admin e 5 observações de tamanho/fronteira RSC.
  A ação valida a empresa com `requirePlatformTenantTarget` antes de gravar a flag.
- `git diff --check`: passou.
- O `agent:verify` fast/full não foi executado porque ambos iniciam `vitest run`
  para a suíte inteira, fora da validação focada aprovada para esta etapa. Nenhum
  teste de banco, build, migration ou acesso a `.env.local` foi executado.
- Item 8, baseline autenticada em produção, permanece com o Maestro.

## Correções após a revisão do Vigia

- Corrigida a interferência da preferência 115%/130% com o CRM normal e adicionado
  teste de classe/escopo para a preferência 115% sem a flag.
- Tema claro não depende mais da lista de rotas em opt-out; o teste cobre uma rota
  opt-out com a flag ativa.
- O `BottomSheet`, o `DropdownMenuSubContent` e os portais/positioners receberam o
  escopo ativo; o teste renderiza cada wrapper com e sem `ArcScopeProvider`.
- DEC-149 explicita a ativação e desativação individual por empresa pelo Super-admin.
- Validação das correções: 4 arquivos de teste focados, 38 testes passaram;
  `npx tsc --noEmit -p .` passou; ESLint dirigido passou sem erros (4 avisos
  preexistentes em `attachment-upload.tsx`).

Commits locais:

- `bdbbe467 docs: registra excecao visual do Diretor Lite`
- `56b46d0a feat(diretor-lite): habilita piloto por empresa`
- `1d281acf feat(diretor-lite): isola skin Arc nos portais`
- `e07cc6e4 feat(diretor-lite): protege alias e adiciona verificador`
