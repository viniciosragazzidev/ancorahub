# Regras de trabalho para IA — CorreTop

Este arquivo é a instrução operacional para agentes e colaboradores. Ele complementa
`AGENTS.md`; em conflito, a instrução mais específica e mais recente do usuário tem
prioridade.

## 1. Fontes de verdade

1. Solicitação atual do usuário.
2. `docs/decision-log.md` para decisões aprovadas e pendências bloqueantes.
3. `docs/business-rules.md` para comportamento do domínio e rastreabilidade.
4. `CorreTop_Documento_Requisitos.md` para requisitos funcionais e não funcionais.
5. `CorreTop_Arquitetura_Desenvolvimento.md` para arquitetura e processo.
6. `DESIGN.md` para linguagem visual e acessibilidade.

Não invente requisito de negócio. Se uma decisão alterar escopo, segurança, cobrança,
retenção ou integração externa, registre-a antes de implementar.

## 2. Limites desta fase

- Não instalar, trocar ou atualizar pacotes sem autorização explícita.
- Não criar integrações externas, contas, chaves, webhooks públicos ou automações de
  produção sem autorização explícita.
- Não usar dados pessoais reais em desenvolvimento, testes, imagens ou documentação.
- Preferir documentação, contratos e estruturas reversíveis até a aprovação do stack
  complementar.

## 3. Arquitetura e Next.js

- O projeto usa Next.js App Router, React e TypeScript. Antes de alterar código
  Next.js, consulte a documentação embarcada compatível com a versão instalada em
  `node_modules/next/dist/docs/`.
- Manter rotas em `src/app/`; código de domínio deve ficar fora das rotas e organizado
  por domínio em `src/features/`, conforme a arquitetura de referência.
- Componentes de servidor são o padrão. Adicione `"use client"` apenas para estado,
  efeitos, APIs do navegador ou interação que realmente o exija.
- Use Server Actions para mutações internas autenticadas e Route Handlers para
  webhooks, integrações e APIs estáveis. Ambos devem validar entrada, autorizar e
  auditar quando aplicável.
- TypeScript estrito: não introduza `any`, coerções inseguras ou supressões de tipo
  sem justificativa localizada.

## 4. Segurança, LGPD e isolamento

- Tenant e identidade vêm exclusivamente da sessão/contexto confiável do servidor.
  Nunca aceite `tenant_id`, papel ou escopo de acesso do cliente como autoridade.
- Toda leitura e mutação de dado de tenant deve aplicar o escopo de tenant e, quando
  necessário, filial, equipe e responsável. A ausência do escopo é um erro, não um
  acesso global implícito.
- Minimize dados pessoais e dados de saúde; use armazenamento privado para documentos
  e URLs temporárias/autorizadas para acesso.
- Registre auditoria imutável para acesso/alteração de dados sensíveis, exportações,
  alterações de permissão, autenticação e ações administrativas relevantes.
- **Controle e Auditabilidade de Novas Features**: Toda nova implementação deve ser auditável (gerando logs de auditoria correspondentes), configurável/editável e passível de ser ativada ou desativada a qualquer momento sob demanda por um super-admin.
- Nunca exponha segredos ao cliente. Variáveis `NEXT_PUBLIC_*` só podem conter dados
  conscientemente públicos.

## 5. Qualidade e entrega

- Validar entradas no limite do servidor com schemas tipados; validar regras de
  domínio também no serviço que executa a operação.
- Isolar lógica crítica (SLA, round-robin, comissão, permissões e integridade) em
  funções determinísticas e testáveis antes de conectá-la à interface.
- Toda mudança deve manter os documentos de regra e decisão alinhados quando afetar
  comportamento de negócio ou arquitetura.
- Seguir Conventional Commits. Não incluir alterações não relacionadas nem sobrescrever
  alterações pré-existentes do usuário.
- Antes de concluir uma feature, aplicar o checklist em `docs/engineering-checklist.md`.
- **Roadmap obrigatorio apos toda implementacao:** ao concluir uma feature ou item do
  plano, atualize imediatamente o item correspondente em `/roadmap` e em
  `src/features/roadmap/roadmap-data.ts`. O item deve conter status, descricao do
  escopo entregue, resumo tecnico com arquivos/fluxos afetados e validacoes executadas.
  Nunca marque um item como `done` sem esse registro; se a entrega for incompleta,
  use `partial` e descreva claramente o que ainda falta.
- **Build obrigatorio:** sempre execute `npm run build` ao finalizar qualquer
  implementacao. Uma feature nao pode ser considerada concluida nem marcada como
  `done` no roadmap se o build de producao nao passar.

## 6. Interface

### Referência visual do dashboard

As referências Nexus são apenas direção de composição. Preserve a identidade CorreTop, dados reais e o comportamento completo em light/dark. Use shell lateral, toolbar, cards compactos, gráficos em camadas e tabelas operacionais sem copiar conteúdo fictício da referência.

- `DESIGN.md` é a fonte visual. Preserve a aparência clara, calma e profissional; a
  interface deve priorizar leitura, contexto e urgência operacional, não decoração.
- **Padronização é obrigatória:** use componentes reutilizáveis de `src/components/ui/`
  (shadcn) e `src/components/unlumen-ui/` (Unlumen) e
  tokens centralizados para tipografia, espaço, raio, cor, elevação e estados. Antes de
  criar uma variação, procure o componente existente; se faltar uma capacidade, evolua
  sua API ou crie uma variante documentada, em vez de estilizar uma cópia local.
- Estilos no componente de uma página devem tratar somente layout e composição
  exclusivos daquela página. Valores arbitrários para tamanhos de fonte, paddings,
  alturas, bordas, cores e botões repetidos são proibidos quando houver token ou
  componente correspondente.
- A fundação obrigatória de UI está em `docs/ui-foundation.md`: use o MCP do shadcn
  antes de implementar UI e comece dashboards a partir de `dashboard-01`, adaptando os
  dados e tokens sem copiar o template genérico. Consulte a documentação do Unlumen e
  use seus componentes para estados animados e feedback. Componentes são adicionados
  sob demanda, nunca em lote.
- Para qualquer motion novo, use a skill local `transitions-dev`; aplique seus tokens
  e o guard de `prefers-reduced-motion`. Escolha o efeito de menor complexidade que
  comunique a mudança de estado e não adicione uma biblioteca de animação sem aprovação.
- Use estados de carregamento, vazio, erro, sucesso, permissão negada e indisponível
  quando relevantes. Não dependa exclusivamente de cor para comunicar estado.
- **Padrão de telas operacionais:** listas administrativas e de trabalho devem seguir a
  composição de `/leads`, `/filiais` e `/equipe`: cabeçalho com contexto e ação principal, conteúdo em
  container responsivo, toolbar/tabela com alinhamento consistente, estados vazio e
  espaçamento padronizado. Evite distribuir CRUD em cards laterais desproporcionais;
  use drawers/sheets para criação e mantenha a lista como foco visual principal.
- **Local-First e UI otimista:** mutações interativas devem refletir a intenção do
  usuário imediatamente, sincronizar em segundo plano e fazer rollback explícito em
  caso de erro. Use TanStack Query quando houver cache de servidor, sempre com chaves
  contendo `tenantId` e `userId`. Estados local, confirmado e erro devem usar tokens
  semânticos (`warning`, `primary`, `destructive`) e nunca uma cor azul fixa; preserve
  `prefers-reduced-motion` e evite layout shift. Consulte `docs/local-first-spec.md`.
- Acessibilidade mínima: HTML semântico, navegação por teclado, foco visível, rótulos
  de formulário e contraste adequado.
## 7. UX, clareza e reducao de carga cognitiva

## Governanca obrigatoria das novas implementacoes

- Toda implementacao nova deve ser auditavel: registrar quem ativou, alterou,
  desativou ou reativou a capacidade, quando isso ocorreu, qual foi o escopo
  afetado e o resultado da operacao.
- Toda implementacao nova deve ser editavel por uma superficie administrativa
  apropriada, com validacao no servidor, autorizacao por papel e feedback claro
  sobre o que foi alterado.
- Toda implementacao nova deve possuir estado operacional explicito e reversivel
  (`active`/`inactive`, ou equivalente), permitindo ao Super-admin desativar e
  reativar a capacidade sem apagar dados e sem depender de alteracao manual no
  codigo ou no banco.
- O controle do Super-admin deve aplicar-se a capacidade real em producao, ser
  isolado por tenant quando necessario, registrar auditoria imutavel e informar ao
  usuario quando uma dependencia estiver desativada ou indisponivel.
- Se uma capacidade ainda nao tiver essa superficie de governanca, ela deve ser
  registrada como `partial` no roadmap, nunca como `done`.

- Antes de iniciar qualquer fluxo, tela ou alteracao de navegacao, consulte
  `docs/ux-audit-2026-07-13.md` e registre o papel do usuario, seu objetivo, a acao
  principal e o estado de prontidao do modulo. Toda tela deve deixar claro onde estou,
  o que importa agora, qual e o proximo passo e o que acontecera depois.
- A navegacao deve ser orientada por papel, permissao e prontidao real do modulo.
  Nao apresente como acionavel uma rota planejada, placeholder ou capacidade ainda
  nao funcional; indisponibilidade deve informar motivo, alternativa e proxima acao.
- Nunca use badges, contadores, status ou metricas operacionais fixos no codigo.
  Eles devem vir de consulta autorizada e escopada por tenant/usuario; sem dado
  confiavel, omita o indicador ou apresente carregamento.
- Todo controle interativo precisa ter consequencia implementada, rotulo claro,
  feedback de sucesso/erro e recuperacao possivel. Botoes sem acao e links que nao
  navegam sao proibidos; controles desabilitados explicam o motivo e a alternativa.
- Toda tela relevante deve cobrir carregamento, vazio, erro, sucesso, permissao
  negada e indisponibilidade/sincronizacao. O usuario nao pode ficar sem explicacao,
  sem proximo passo ou perder trabalho ao recuperar um erro.
- Limite a hierarquia visual a uma acao principal e no maximo tres acoes prioritarias
  por contexto. Remova dashboards duplicados, cards decorativos e alertas sem decisao.
- A promessa da busca deve corresponder ao escopo real de indexacao e aos resultados.
  Preserve query, filtros e contexto na URL quando isso ajudar retorno e suporte.
- Abas, filtros, paginacao e selecoes que definem contexto devem ser recuperaveis por
  URL quando apropriado. Use vocabulario e taxonomia de status consistentes.
- Para dados sensiveis, exportacoes, permissoes e exclusoes, explique o impacto no
  ponto da decisao, confirme quando houver risco real, registre auditoria e ofereca
  desfazer quando possivel. Reduza PII por padrao.
- Toda revisao deve verificar semantica, teclado, foco, leitores de tela, rotulos,
  contraste, zoom, viewport estreito, comunicacao sem depender de cor e
  `prefers-reduced-motion`.
- Em mudancas relevantes, valide fluxos com cenarios sinteticos antes de concluir.
  Nao invente evidencia de usuario real; diferencie inspecao heuristica, teste
  observado e hipotese a validar.
