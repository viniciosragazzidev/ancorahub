# T125: Gestor e supervisor no Lite de equipe

## Decisão

O gestor Lite consulta e administra corretores da sua unidade. O supervisor Lite
consulta e administra somente corretores com `supervisorId` igual ao próprio
usuário. Todas as leituras e mutações validam o tenant e o escopo novamente no
servidor. A lista e o perfil do supervisor permanecem restritos à equipe atual.

## Plano

1. Corrigir geração de link de senha e revogação de convite, com testes focados;
   registrar essa correção em commit separado antes da interface.
2. Incluir lista de corretores da unidade no `/equipe` do gestor Lite, com convites
   pendentes, busca, contadores e ações compatíveis com o escopo.
3. Reutilizar o perfil Lite existente para gestor e supervisor; acrescentar ações
   permitidas e dados do perfil normal em leitura, sem edição de autoridade ou
   escala.
4. Adicionar rotas exatas do gestor, atalho no Início e testes de allowlist.
5. Registrar DEC, executar testes focados, type-check e ESLint dos arquivos alterados.

## Estados e acessibilidade

Lista: carregada, filtrada, vazia por ausência de unidade e sem resultados de busca.
Perfil: carregado, fora do escopo (404), estado de ação pendente, sucesso e erro.
Reutilizar primitives Lite existentes; controles com rótulos e foco visível. Não
introduzir tokens, primitives ou animações.

## Verificação

Sem teste de banco, suite completa ou build de produção. A evidência dos testes e
checagens foi registrada em `reports/agent/verification/2026-10-14-team-lite-management.md`.

Parte 0 foi entregue em commit próprio `848b9cc9`. A lista e o perfil continuam
atrás de `MANAGER_LITE`; o supervisor permanece limitado à equipe. O roadmap N107
continua parcial porque outras áreas de gestão ainda não foram migradas.


## T126: Manager Lite chat rail

The manager desktop reuses the existing ChatHome rail used by brokers and supervisors. Its two conversations open Leads da unidade and Minha unidade, with summaries derived from the authenticated unit scope. getManagerLiteLeads uses React cache per request so layout and page can share the query. Mobile, broker, supervisor, and the disabled MANAGER_LITE flag retain their prior behavior. Evidence: reports/agent/verification/2026-10-14-manager-lite-rail.md.

### T126b: rail and home visual parity

The manager desktop keeps the broker Lite's shared rail header and row components, adds the unit waiting-lead badge and unit-only summaries for Leads da unidade, Minha unidade, Desempenho da unidade, and Notificações. The home uses the same cached rail data and existing four-stat tile layout, including active brokers without a ready WhatsApp connection. Supervisor and manager mobile headers retain their prior WhatsApp button behavior. The WhatsApp count is scoped to the manager's active brokers in the same tenant and branch. No new visual primitive or token was introduced. Validation: `reports/agent/verification/2026-10-14-manager-lite-rail-visual.md`.

## E4 Equipe e unidade (2026-10-14)

O Gestor Lite tem resumo somente leitura da unidade em `/unidades/<branchId>`, aprovado pela allowlist e validado pelo tenant e pela unidade autenticados. O resumo exibe indicadores, membros e destaques sem oferecer controles de distribuicao. A pagina reutiliza o Lite e inclui estados vazios, skeleton, animacao com `motion/react` e respeito a `useReducedMotion`.

O supervisor pode convidar um corretor novo para a unidade e equipe atuais. O Gestor pode convidar corretor ou supervisor para sua unidade e selecionar corretores livres para atribuicao inicial opcional. A migration 0199 persiste `supervisorId` e `supervisedBrokerIds` nos convites. O aceite revalida tenant, unidade, papel e disponibilidade dos corretores selecionados antes de atribuir a equipe. Reenvio preserva esses dados; listagem, reenvio e cancelamento dos convites pendentes continuam escopados no servidor.

O perfil da unidade do Gestor e somente leitura. Convites do supervisor aparecem no painel de convites pendentes, junto dos pedidos de equipe. Corretor e supervisor seguem usando suas telas existentes; supervisor continua limitado a `supervisorId = context.userId`.

Validacao direcionada: 11 arquivos e 53 testes focados passaram; `npm run type-check` passou; ESLint registrou zero erros e dois avisos existentes de `no-explicit-any` em `onboarding-helpers.ts`. `git diff --check` passou. Nenhum teste de banco, suite completa, `agent:verify` ou build de producao foi executado. Os 12 prints comparativos de gestor, unidade e supervisor em desktop e celular, claro e escuro, estao em `tmp/e4/`; a evidência está em `reports/agent/verification/2026-10-14-lite-e4-equipe-unidade.md`. Os componentes Arc usados pelo Lite continuam no tema claro definido pelo escopo Venancor.
