# Gestor de unidade no painel do modo gestão (27/11/2026)

Pedido do Vinicios: o gestor de unidade passa a ter o mesmo painel do modo gestão (o Lite do diretor), com o
**mesmo estilo e o mesmo design**. A diferença é só o foco: a unidade dele, os supervisores dela e os corretores dela.
Nada de tela própria nem visual diferente. São os mesmos componentes do diretor, alimentados com o recorte da unidade.

## Como está hoje

- **O gestor de unidade não entra no visual Lite.** `shouldUseDirectorLiteStyle` devolve falso para quem
  `isOutsideManagerScope` (papel `manager` fora de marketing e financeiro). Ele usa a moldura antiga (modo normal),
  com o `CommandCenter` em `/dashboard`.
- **As rotas dele são uma lista fechada.** `MANAGER_ALLOWED_ROUTES` (`src/features/manager-scope/manager-routes.ts`)
  libera `/dashboard`, `/equipe/*`, `/unidades/:id`, `/plantoes/corretor/:id`, o lead da unidade, `/tarefas`,
  `/tarefas/ligacoes`, `/ia/perguntas`, `/notificacoes` e `/settings`. O layout redireciona o resto para `/equipe`
  (fail closed).
- **Os dados do painel já sabem recortar por unidade.** `getEssentialDashboard` usa `resolveReportDataScope` e
  `resolveOverviewFilter`. Para o papel `manager`, `resolveOverviewBranch` fixa a unidade da sessão
  (`source: "session"`) e ignora o que vier na URL.
- **Existe um Lite próprio de gestor** (`getLiteAudience` = `"manager"`, chrome do chat). Este plano não mexe nele.

## O que muda

### 1. Quem entra no visual Lite

- `shouldUseDirectorLiteStyle`: deixar o gestor de unidade com unidade definida (`context.branchId`) entrar.
- Gestor sem unidade continua na versão antiga, com o aviso de hoje (fail closed).
- Uma chave nova por empresa, `feature_manager_lite_panel`, desligada no início, para soltar com um gestor piloto antes.
- Marketing e financeiro seguem como hoje.

### 2. Rotas (continua lista fechada)

- Manter `MANAGER_ALLOWED_ROUTES` como fonte única. Ele **não** ganha `/leads`, `/distribuicao`, `/conversas` nem
  configuração do sistema: a decisão de 10/11 continua valendo.
- O Painel do Lite tem atalhos para telas fora dessa lista. Cada atalho passa a perguntar a regra
  (`isManagerRouteAllowed`) e some quando ela nega. Para o gestor, alguns atalhos trocam de destino:
  - "Ver os leads" vai para o perfil do corretor ou para o lead da unidade;
  - "Plantões" vai para `/equipe/plantoes`.

### 3. Menu lateral do gestor no Lite

Mesmos ícones e o mesmo desenho do diretor, só com o que ele abre:

- Início (o Painel);
- Equipe;
- Plantões da unidade;
- Pós-venda;
- Tarefas e Ligações;
- Perguntas da IA;
- Notificações e Ajustes.

O nome da unidade aparece no topo do menu, no lugar de "Área de Plantão".

### 4. Painel (`/dashboard`) recortado na unidade

- **Visão geral, Qualidade dos leads e Funil:** os mesmos componentes do diretor (`DirectorLiteDashboard`,
  `renderDirectorLiteQuality`, `DirectorLiteQualificationFunnelPage`), chamados com a unidade da sessão.
- **Sem seletor de unidade.** O título mostra "Unidade Matriz 20º Andar".
- **Fila:** o seletor de fila lista só as filas que atendem a unidade.
- **Auditar cada bloco do Painel.** Alguns blocos contam "agora" fora do filtro de leads (plantões em andamento,
  WhatsApp conectado, corretores disponíveis, ao vivo, cartões de atenção). Cada um precisa ler a unidade da sessão.
  Onde não der, o bloco some para o gestor; não pode mostrar número da empresa toda.
- **Gaveta de atenção:** só itens da unidade, com links que o gestor abre.

### 5. Supervisores e corretores da unidade

- **Equipe:** a tabela do Lite (padrão `/equipe`), com os supervisores e os corretores da unidade. Ao clicar, abre a
  mesma gaveta do diretor.
- **Painel:**
  - os blocos por pessoa (ranking, tempo de resposta, sem 1º contato, conversão) listam só gente da unidade;
  - um filtro "Supervisor ▾" no topo recorta pelo time de um supervisor;
  - o filtro usa o mesmo componente de filtro do Painel.
- **Corretor de outra unidade num plantão da unidade:** aparece só com o que fez na unidade, sem os números dele em
  outras unidades.

### 6. Telas que ele já tem, no visual Lite

`/equipe`, `/equipe/plantoes`, `/equipe/pos-venda`, `/tarefas`, `/tarefas/ligacoes`, `/ia/perguntas` e o perfil do
corretor já têm ramo Lite ou seguem o padrão dele. Com o gestor dentro do visual Lite, elas passam a abrir assim.
Cada uma é conferida para ver se segue recortada na unidade e se não mostra ação de diretor (editar régua do
pós-venda, regra R0, configurações da empresa).

## Segurança

- O recorte continua no servidor, nunca só na tela. Toda consulta nova ou alterada lê `context.branchId` pelo
  `resolveReportDataScope` e ignora unidade vinda da URL para o gestor.
- **Testes de regra:** gestor com unidade A não vê número da unidade B em nenhum bloco do Painel; gestor sem unidade
  cai na versão antiga.
- **Teste de rota:** com o visual Lite ligado, toda rota fora de `MANAGER_ALLOWED_ROUTES` continua redirecionando.
- **"Ver como" gestor:** o diretor confere exatamente o que o gestor vê.

## Etapas e entregas

1. **Regra e chave.** `shouldUseDirectorLiteStyle`, a chave `feature_manager_lite_panel` e os testes de regra.
   Chave desligada: nada muda para ninguém.
2. **Menu lateral e atalhos.** Os itens do gestor, o nome da unidade e os atalhos do Painel filtrados pela regra de
   rotas.
3. **Painel recortado.** A auditoria de cada bloco do Painel e da gaveta de atenção, a correção dos que contam fora
   da unidade e o título com a unidade, sem seletor.
4. **Telas que ele já tem.** Conferir cada uma no Lite com o gestor, esconder as ações de diretor e testar.
5. **Piloto.** Ligar a chave para um gestor, conferir com "ver como" (1440 e 375) e depois soltar para todos.

## Perguntas em aberto (com a recomendação)

1. **O gestor vê a aba Funil?** Recomendado: sim, se a central de qualidade estiver liberada para ele
   (`canReadQuality`), como já acontece hoje no modo antigo.
2. **Os atalhos para Leads e Conversas aparecem?** Recomendado: não, porque a decisão de 10/11 continua. Se for
   preciso, isso vira um plano separado ("lista de leads da unidade" e "conversas da unidade").
3. **E o gestor que hoje usa o Lite próprio de gestor (chat)?** Recomendado: continua nele até decidirmos unificar.
   Este plano vale para o gestor no modo normal.
