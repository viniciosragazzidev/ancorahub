# 2026-09-21 — Consolidar o controle da Meta em `/marketing/campanhas`

**Estado:** plano aprovado · **passo UI adiantado (2026-09-21):** controles atuais movidos de `/integrations/meta` para `/marketing/campanhas` sem mudar ações/política; fases 0–3 e 5 ainda pendentes
**Objetivo:** `/marketing/campanhas` passa a ser o único lugar de controle (captura e fila);
`/integrations/meta` vira visualização + conexão + sincronização.
**Sem migração de banco.** Hoje não há conflitos de dados (informado pelo produto).

## Decisões aprovadas

1. Conectar, reconectar e desconectar a Meta **ficam em `/integrations/meta`**, junto do
   status e do botão Sincronizar. O controle vai somente para Campanhas.
2. Excluir um anúncio dentro de campanha ativa só é oferecido **onde a política o respeita**
   (modo "Todas"). No modo seletivo o drawer mostra "Herdar da campanha" ou "Fila própria".
   Nenhuma mudança na política de captura de leads.
3. Trocar a fila de uma campanha/anúncio que já tem fila é **direto, com confirmação**
   ("leads futuros vão para X; leads em andamento não mudam"), sem o passo "desativar antes".
4. Permissões: ativar e escolher fila = diretor, marketing e gestor da fila; **ignorar
   (pausar) = diretor e marketing**.

## Achados do código que definem o desenho

- Uma linha de rota (`meta_campaign_queue_routes`, `meta_ad_queue_routes`) guarda captura
  (`enabled`) **e** fila (`queueId`).
- Escritores atuais com semânticas diferentes: toggle de captura (`meta-ads/actions.ts`, só
  `enabled`, sem checagem de papel, com cascata para os anúncios ao ativar); salvar fila do
  detalhe (`enabled: true` forçado); "Entradas e exceções" em `/distribuicao` (desativar zera
  `queueId`); modo global na integração.
- `resolveMetaCapturePolicy`: prioridade anúncio > formulário > campanha; no modo seletivo um
  filho desativado **não** exclui dentro de campanha ativa. A função não tem teste hoje.
- Ativar campanha grava uma linha ativa por anúncio; desativar não desfaz.
- Formulários têm toggle mas não têm ação de fila. Ids se misturam (uuid × id da Meta).
- Consumidores da política (não podem regredir): `communication-channels/meta-lead-ads.ts`,
  `lead-distribution/service.ts`, `ai-agent/qualification-timeout-sweep.ts`,
  `meta-ads/meta-analytics-service.ts`.

## Arquitetura alvo

- **Serviço único de escrita** `meta-capture-control` com dois comandos independentes:
  `setCapture` (só `enabled`) e `setQueue` (só `queueId`). Centraliza permissão, transação,
  concorrência otimista (`updatedAt`) e auditoria; usa somente o id da Meta.
- **Estado efetivo calculado no servidor** pela própria `resolveMetaCapturePolicy`.
- **UI** em `/marketing/campanhas`: modo de captura no topo (com contagem de ativos afetados
  antes de confirmar), visões Campanhas (anúncios agregados) · Anúncios (lista independente) ·
  Formulários, busca/filtros no servidor, anúncios sob demanda e paginados, drawer (`DsSheet`)
  com Captura · Fila · Efeito (simulador) · Histórico, deep link `?asset=`, salvar otimista
  com desfazer.
- **`/integrations/meta`**: status, permissões, expiração, erro, Sincronizar, conexão,
  inventário em contagens, sincronizações recentes e link "Gerenciar captura e filas".

## Fases (cada uma reversível; rollback = flag ou revert do commit)

| Fase | Entrega | Verificação |
| --- | --- | --- |
| 0 | Testes de caracterização de `resolveMetaCapturePolicy` (modo × rotas) e das ações atuais | testes verdes **antes** de qualquer mudança |
| 1 | Serviço de comandos + permissões (por papel) + auditoria; nenhuma tela muda | testes de comando e de papel |
| 2 | Consulta de leitura agregada (campanhas, anúncios, formulários, estado efetivo, fila) | teste do estado efetivo × política |
| 3 | UI nova em `/marketing/campanhas` atrás de feature flag | revisão visual; QA |
| 4 | `/integrations/meta` enxuta | conexão e sync intactos |
| 5 | Retirar controles duplicados (`/distribuicao` vira resumo + link; card de fila do detalhe vira o drawer); aposentar ações antigas | grep: um único escritor |
| 6 | QA no ambiente de QA, documentação, mapa de autoridade | checklist |

## Conflitos e erros: proteções

Dois escritores → serviço único · pausar apagando fila → comandos separados · edição
simultânea → precondição por `updatedAt` e aviso de conflito · promessa que a política não
cumpre → opções derivadas da política · troca de modo global → confirmação com impacto ·
cascata de linhas → herança por ausência de linha · ativo removido na sincronização → estado
"ativo removido" no drawer · permissão → checagem central com teste por papel · regressão na
captura → Fase 0 antes de tudo.

## Passo já entregue (antes da Fase 0)

- `/integrations/meta`: conexão + sincronização + inventário em contagens. A lista "Sincronizações
  recentes" virou **um selo** com o status da última sincronização (`meta-sync-status.ts`).
  O modo de captura aparece só como texto, com link "Gerenciar captura e filas".
- `/marketing/campanhas`: recebeu o Controle Mestre e a "Captura por ativo" (Formulários ·
  Anúncios · Campanhas em lote), código **movido sem alteração** (`meta-capture-controls.tsx`),
  faixa de status (selo + modo + link para a integração) e padding nos KPIs.
- Nada muda na política de captura nem nas ações de servidor.

## Fora de escopo

Mudar a política de captura no modo seletivo; migração de dados; conexão/OAuth da Meta.
