# UX-GOV-1 — Refinamento transversal e governança

Data: 2026-09-04. Estado: em execução. Autoridade: solicitação de refinamento global
do usuário; complementa o Contrato de Redesign e não altera regras de domínio.

## Diagnóstico confrontado com o código

O grafo `.ua/knowledge-graph.json` foi consultado; seu snapshot é anterior às
foundations de setembro. As decisões abaixo foram confirmadas nos arquivos atuais.

| Evidência | Problema | Solução autorizada |
| --- | --- | --- |
| `src/app/globals.css` | Borda geral forte e input branco sem delimitação em light; tokens de espaço já existem | Recalibrar os tokens sob o controle Clean UI existente, preservar marca e contraste |
| `src/components/ui/button-variants.ts` | Botões pill, alturas e texto diferentes dos campos | Mesma gramática de controles, variantes existentes preservadas |
| `src/components/ui/card.tsx` | Oculta scrollbars de todos os descendentes | Deixar áreas roláveis perceptíveis; bordas e superfícies discretas |
| `src/components/corretop-sidebar.tsx` | Cores/glows locais, status WhatsApp fixo e rótulos incompatíveis com destinos | Tokens da rail, foco visível, rótulos reais, sem indicador de conexão inventado |
| `src/components/foundations/page-tabs.tsx` | Documentação promete atalhos e indicador animado não implementados | Documentar navegação por links versus tabs locais; foco e largura responsiva |
| `src/components/foundations/filter-bar.tsx` | Campo sem nome acessível independente do placeholder | Nome acessível e geometria compartilhada |
| `dashboard/_components/executive-dashboard.tsx` | Importa UI da rota de relatórios; gráfico vem antes dos indicadores | Extrair apresentação para `features/reports/components`; indicadores primeiro, análise em seguida |
| `relatorios/_components/*-tab.tsx` | Tabelas nativas e cards locais concorrentes | Reusar primitives; preservar métricas, período, permissão e destinos |
| `src/features/clean-ui/feature.ts` | Já há controle global e exceções por tenant | Reutilizar resolução server-side e ações auditadas do Super-Admin; não criar flag concorrente |
| `UX_FOUNDATIONS.md`, `UX_FUNCTIONALITY_MATRIX.md` | Aprovações gerais e descrições não demonstradas | Registrar implementado, verificado e pendente separadamente |

## Padrões obrigatórios

REUSE → REFINE → EXTEND → CREATE. Fonte: `src/components/ui`,
`src/components/foundations`, `src/components/unlumen-ui`. Páginas compõem; componentes
controlam aparência; servidor controla escopo. A escala existente 4/8/12/16/24/32/48
define inline/item/grupo/seção. Inter permanece a família instalada. Títulos 20–24,
seções 16, corpo/controles 14 e metadados 12; números tabulares. Não criar cores de
negócio na UI. Cards não são o container obrigatório de toda informação.

Novos aliases de refinamento (`--ui-control-height`, `--ui-control-font-size`,
`--ui-button-radius`) só descrevem a apresentação compartilhada. São definidos em
uma folha escopada ao shell autenticado Clean UI; fallback mantém o estilo anterior.
Não são parâmetros de autorização nem modificam regras do tenant.

## Sequência e critérios

1. Inventariar rotas e dependências visuais estaticamente. O inventário não prova QA.
2. Consolidar tokens e primitives, habilitados pela política Clean UI já auditada.
3. Refinar rail/cabeçalho/foundations e dashboard; manter abas autorizadas e carga
   apenas da aba ativa. Preservar `/relatorios` e suas funções documentais.
4. Revisar famílias operacionais (Leads, detalhe, Conversas, Equipe, Unidades,
   configuração, integrações) pelo impacto dos componentes compartilhados. Não
   alterar envio Meta/WAHA, distribuição, SLA ou a experiência `/conversas/broker`.
5. Validar renderização dos componentes reais com dados sintéticos, desktop
   1366×768/1440×900/1920×1080 e mobile 390×844, light/dark, overflow, teclado,
   estados e rollback. Registrar separadamente QA autenticado ainda não observado.
6. Rodar verificações, atualizar changelog, foundations, matriz e roadmap.

## Performance das tabs do `/dashboard`

O atraso percebido vinha de uma combinação de três fatos: cada troca altera os
`searchParams` e reexecuta o Server Component do dashboard; a aba selecionada
carrega dados próprios no banco; e a camada cliente mostrava um skeleton assim
que `router.replace` começava, mesmo quando o usuário já tinha indicado a
próxima aba.

A correção mantém o fetch no servidor (com o contexto confiável do tenant), mas
usa o cache de RSC do App Router de forma antecipada: abas são pré-carregadas em
idle e também no hover/foco, antes do clique. A navegação continua com
`scroll: false`, a seleção visual é imediata e o skeleton só aparece quando a
aba ainda não está pronta. Não foi colocado um cache global de métricas, pois
isso poderia servir dados entre tenants ou deixar indicadores obsoletos.

## Mini-spec de dashboard

Usuário: diretor, gestor e supervisor dentro do escopo atual. L1: aba, período,
indicadores e atenção. L2: tendência e funil. L3: tabelas analíticas e documentos.
Uma Home `/dashboard`; sem introduzir Atendimento/Metas sem contrato de métricas.
KPIs não inventam links; destinos existentes de alertas continuam preservados.
Mobile empilha grupos, abas rolam horizontalmente e tabelas rolam dentro da região.
Nenhum reset de scroll causado por dados; troca de rota pertence ao shell.

## Gate de entrega

Todo lote registra problema, antes/depois, componentes, funções movidas/preservadas,
responsividade, acessibilidade, visual QA, testes, typecheck, build, limitações e
rollback. Captura sintética é evidência de componente, não validação de permissão
de produção. Ausência de evidência mantém `PARTIAL`, nunca `APPROVED` por inferência.
Revisão de consistência a cada 3–5 superfícies. Dívida P0: perda de acesso/dados;
P1: corte/função inacessível; P2: inconsistência; P3: polimento.

O pedido global autoriza o impacto transversal das primitives e o refinamento do
dashboard. A certificação individual UX-1C–UX-1J continua dependente de seus gates.
