# Cargos e permissões: o cargo manda no que a pessoa vê (04/11/2026)

**Pedido do Vinicios (04/11, P1 da semana):** estrutura consistente de permissão por cargo: rotas, menu e
áreas dentro das rotas; área de cargos e funções melhor em /equipe; primeiro cargo **Plantões**.

## Ponto de partida (mapa de 04/11)

- Já existe cargo personalizado: `custom_roles` + `custom_role_permissions` + `tenant_memberships.custom_role_id`,
  tela `/equipe/cargos`, ligado em produção (`feature_custom_roles_enabled` e as 3 empresas). Nenhum membro usa.
- Um cargo **substitui** as capacidades do papel (allowlist de chaves + `route:<chave>`). Regras em
  `src/features/custom-roles/service.ts`.
- Furos que tornam o cargo inconsistente hoje:
  1. Bloqueio de URL só no `layout.tsx` e só para 13 rotas do `routeCatalog`; rota fora do catálogo passa
     direto (plantoes, minha-fila, tarefas, clientes, relatorios...). Casamento por prefixo pega
     `/leads/distribuicao` como "leads".
  2. ~250 checagens cruas de papel (`context.role === ...`, `hasPermission(role)`) em ~73 arquivos de
     `src/app/(dashboard)`, que ignoram o cargo.
  3. Menus Lite (`light-routes.ts`) não olham permissão nem cargo. `navigation-access.ts` tem listas cruas por
     papel/jobTitle e um bug (`route:/filiais` em vez de `route:filiais`).
  4. Áreas dentro das rotas (abas de distribuição, seções do lead, cargos em /equipe) não têm chave.
  5. Sem helper único: cada chamada efetiva faz 1 a 2 queries sem memo por request.

## Regras da estrutura

1. **Papel** (`role`) continua sendo o piso de segurança e o escopo de dados (tenant, unidade, carteira).
2. **Cargo** decide o que aparece: menu, rotas e seções. Sem cargo, tudo segue como hoje (papel + jobTitle).
3. Uma fonte só no servidor: `getEffectiveAccess()` (memo por request) devolve capacidades, rotas e seções.
4. **Fail closed para quem tem cargo:** rota ou seção fora do catálogo é negada para membro com cargo.
5. Seção = chave estável `secao:<rota>.<area>` (ex.: `secao:distribuicao.filas`), cadastrada em catálogo,
   checada no servidor (não basta esconder no cliente).

## Revisão do Vigia (04/11) incorporada

- **Efetivo = papel ∩ cargo** em todo helper: o cargo só restringe, nunca amplia o que o papel permite
  (hoje, com cargo, o papel é ignorado). `assignCustomRole` valida papel x cargo.
- **Fail-open a fechar:** cargo sem nenhuma `route:*` hoje abre toda rota cuja permissão o cargo tem (passa a
  abrir nada); rota fora do catálogo passa para todos (para quem tem cargo, passa a ser negada).
- **Flag desligada não solta o cargo** (decisão do Maestro, recomendado): `feature_custom_roles_enabled` e
  `tenant_custom_role_settings` passam a controlar só a criação/edição na tela; cargo ativo atribuído continua
  valendo. Para soltar alguém, tira-se o cargo dele.
- **Rotas de plataforma fora de qualquer cargo** (decisão do Maestro): `/internal`, `/noc`, `/empresas`,
  `/roadmap` ficam sempre negadas para quem tem cargo.
- Menu e Lite só escondem; URL, loader e server action checam no servidor (incluindo `duty-actions` e filas).
- Caso de teste principal do Plantões: aba Filas de Distribuição (`canViewDistributionQueues` é `director` cru).

## Fases
- **F0 Segurança e linha de base:** teste de caracterização da matriz atual (papel x rota x ação); papel ∩
  cargo; sem `route:*` = nada; fora do catálogo = negado para quem tem cargo; flag off não solta cargo;
  atribuição validada.

- **F1 Fundação:** `getEffectiveAccess` + `requireRoute`/`canSection`; `routeCatalog` com todas as rotas de
  primeiro nível (plantoes, minha-fila, tarefas, clientes, cotacao, documentos, relatorios, propostas,
  notificacoes, relacionamento, ferramentas, unidades...); casamento pelo prefixo mais longo
  (`/leads/distribuicao` = distribuição); layout nega rota fora do catálogo para quem tem cargo; conserta
  `navigation-access.ts`; menus Lite e sidebar filtrados pelas rotas efetivas.
- **F2 Rotas do Plantões:** trocar as checagens cruas por efetivas em leads, conversas, equipe, distribuição
  (filas e plantão), plantoes e minha-fila, com teste de matriz (com e sem cargo).
- **F3 Tela de cargos em /equipe:** cargo montado por rota com as seções de cada uma, prévia "o que essa pessoa
  vê", contagem e lista de membros, atribuir cargo na lista da equipe e no convite.
- **F4 Cargo Plantões:** criado pela tela (ou script) e atribuído a quem o Vinicios indicar.

## Status

- **F0 e F2 no ar (04/11)**; F0: (`34f72cdf` + `a9f71241`, aprovada pelo Vigia em 04/11). Atribuir cargo está FECHADO por
  `CARGO_PROTEGE_ACOES = false` (custom-roles/service.ts): **remover/ligar na F2**, quando as ações internas
  respeitarem o cargo.
- Pisos de `mensagens` e `fluxos-whatsapp` = `acessar_qualificacao_ia` (Vinicios manteve, 04/11). `/plantoes`
  mantém `acessar_leads` (é o calendário do próprio corretor).

- **F2 (04/11):** fronteira real = **arquivo da ação**. O manifesto do build (`.next/server/
  server-reference-manifest.json`) dá o arquivo de cada ação; `action-areas.ts` diz a área (rota ou
  capacidade) de cada pasta; quem tem cargo só roda ação de área liberada; arquivo sem regra = negado e um
  teste falha se aparecer arquivo de ação novo sem regra. A URL do cliente NÃO é fronteira. Cortes finos:
  `requireCargoCapability` em equipe, distribuição, plantões e importação. Leads e Conversas ainda não têm
  corte fino: o cargo leva a área inteira (`AREAS_SEM_CORTE_FINO`).
- **Não é fronteira (ainda):** `/api/*` não passa pela trava de cargo; as áreas `livre` de action-areas.ts
  (sessão, perfil, notificações, onboarding, disponibilidade, plataforma) confiam na checagem de cada ação.
- **Manifesto em produção:** a imagem standalone (Dockerfile, WORKDIR /app) traz `.next/server/
  server-reference-manifest.json`; sem ele, quem tem cargo fica sem ações (fail closed). Conferir no 1º teste.

## Cargo Plantões (proposta)

| Área | Rota / seção | Pode |
|---|---|---|
| Leads em geral | /leads (todas as unidades, a confirmar) | ver, atribuir e reatribuir |
| Conversas | /conversas | ver e responder |
| Equipe | /equipe (sem Cargos e sem convites de gestor) | ver membros e status |
| Plantões | /distribuicao › Plantão, /plantoes | montar e editar escalas; adicionar e remover corretores convidados sem conta |
| Filas | /distribuicao › Filas e Operar | ver e pausar filas |
| Sugeridos | Notificações, Tarefas, Configurações pessoais (perfil e senha), Resumo do dia da distribuição | ver |
| Escondido | Painel geral, Vendas, Negociações, Relatórios, Financeiro, Qualificação IA, Campanhas, Integrações, Unidades, Configurações da empresa | |

**Papel base pelo escopo (papel ∩ cargo):** só a unidade = `manager` + cargo; empresa toda = `director` + cargo
(o cargo corta tudo o que não é do Plantões). Supervisor não serve (não tem filas nem plantões).

Capacidades: `acessar_leads`, `leads_view_all` (só com base director), `leads_assign`, `leads_reassign`, `acessar_conversas`,
`lead_queues_view`, `lead_queues_manage`, `duty_schedules_manage`, `distribution_audit_view`,
`acessar_tarefas`, `acessar_notificacoes`, `acessar_configuracoes_pessoais`. Escopo: empresa toda (Vinicios, 04/11): papel base director + cargo.

## Critério de pronto

Cargo Plantões criado e atribuível em /equipe; quem tem o cargo só vê o permitido no menu, na URL direta e nas
seções; testes de matriz passando; push após o Vigia; SQL (se houver) com o Vinicios.
