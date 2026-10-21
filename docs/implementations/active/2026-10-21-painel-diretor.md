# Painel do diretor: funil, qualificação e situação dos leads mais claros

Data: 21/10/2026 · Branch: `feat/qualificacao-turbo` · Status: Fase 1 implementada, Fases 2 a 4 planejadas

Objetivo: o diretor abrir uma tela e entender em segundos quantos leads chegaram,
quantos responderam, quantos ficaram prontos para o corretor, quanto custou e onde
os leads estão agora, com números que batem entre as telas.

## 1. Diagnóstico (o que o diretor vê hoje)

| Tela | Problema |
|---|---|
| `/dashboard` | Só o "hoje" (dia operacional começa às 19h). Sem funil, sem período, sem custo. |
| `/dashboard?tab=quality` | Visão simples boa; a detalhada tem ~12 tabelas, densa demais. Sem filtro de unidade. |
| `/qualificacao` (visão geral) | "Taxa de qualificação" mostra uma contagem; "Follow-ups" sempre 0; tempos médios escritos fixos no código (35 s e 2 min); sem período. |
| `/leads/dashboard` | Funil com códigos crus (`quote_sent`), só 5 etapas, "Novos hoje" mostra 7 dias, "Em risco" soma leads com corretores. |
| `/leads` (kanban) | Contagem das colunas é da página atual, não do total. |
| `/relatorios` | Redireciona; a central de relatórios completa (equipe, unidades, receita por origem) não é usada por ninguém. |
| `/noc` | Pizza com 9 cores (fora do design system); "hoje" começa à meia-noite do servidor. |
| `/marketing/campanhas` | "ROI" sem gasto; receita vem de cotação aceita, não de venda; sem período. |

Definições que não batem:
- "Quente": 75/40 no relatório da IA, 80/50 no motor, `qualificationStatus = hot` nos relatórios.
- Conversão: coorte (convertidos ÷ recebidos) nos relatórios; janelas diferentes no resumo do dia.
- Início do "hoje": 19h no painel, meia-noite no NOC e na qualificação.
- Dados existentes e nunca mostrados: entrega e leitura das mensagens, tempo até a primeira resposta,
  motivos de perda, leads em espera manual, tempo da distribuição, receita das vendas.

## 2. Fase 1 (implementada nesta branch): aba "Funil de qualificação"

`/dashboard?tab=funnel`, diretor (empresa toda) e gestor (sua unidade), período 7, 30 ou 90 dias.
Coorte por chegada: toda taxa divide números dos mesmos leads.

- Quatro números: leads que chegaram, % que respondeu (com tempo mediano até responder),
  % qualificados, vendas.
- **Do anúncio à venda**: chegaram → 1ª mensagem enviada → entregue → lida → respondeu →
  qualificado → com corretor → venda, cada etapa com a % da anterior. Barras numa cor só.
- **Onde os leads estão agora**: em qualificação, prontos esperando corretor, em atendimento,
  sem resposta (recebem lembretes), fora de alcance, perdidos, vendas.
- **Testes da primeira mensagem**: cada variante com enviadas, % de resposta (com intervalo de
  confiança) e % qualificados.
- **Qual mensagem trouxe a resposta**: 1ª mensagem, lembrete 20 min, 3h, ligação, despedida.
- **Por que os leads foram perdidos**: motivos agregados (dado já gravado, nunca mostrado).
- **Custo na Meta**: real (preço que a Meta informa por mensagem, depois da migration 0211) ou
  estimado pela tabela de 1/10/2026; custo por lead qualificado.

Arquivos: `src/features/qualification-turbo/funnel.ts`, `components/qualification-funnel-view.tsx`,
`src/app/(dashboard)/dashboard/page.tsx`, `src/features/dashboard/components/dashboard-section-tabs.tsx`.

## 3. Fase 2: números que batem (correções, sem tela nova)

1. Uma definição de "quente" e "qualificado": `qualificationStatus` do lead. Remover os limiares
   75/40 de `ai-qualification/stats-service.ts` e os status inexistentes (`IN_PROGRESS`, `TRANSFERRED`).
2. `/qualificacao`: "Taxa de qualificação" vira % real; tirar os tempos fixos (35 s / 2 min) e
   calcular de `leadOffers`/`aiConversations`; período 7/30 dias.
3. `/leads/dashboard`: nomes das etapas (`LEAD_STATUS_LABELS`), todas as etapas, "Novos" do
   período certo, "Em risco" só com leads.
4. Kanban: contagem das colunas pelo total (consulta agregada), não pela página.
5. Um "hoje" só: dia operacional das 19h, escrito na tela ("desde ontem 19h").

## 4. Fase 3: resultado comercial no mesmo lugar

1. Reaproveitar o que está pronto e sem uso: desempenho por unidade (`getUnitPerformance`) e por
   origem com receita (`getCommercialBySource`) numa aba "Resultados" do painel (tabela + gaveta).
2. `/marketing/campanhas`: período, receita pela tabela de vendas e gasto da Meta (Insights da
   API de Marketing) para custo por lead, por qualificado e por venda.
3. NOC no design system: barras numa cor, sem pizza de 9 cores.

## 5. Fase 4: diretor no modo Lite

Quando o diretor migrar para o Lite (plano `2026-10-14-lite-gestao-completa.md`), a tela inicial
dele usa os mesmos blocos do funil (cartões de número, funil, "onde estão agora") no visual Lite.
