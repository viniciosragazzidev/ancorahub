# Lite estilo rede social, Frente A: navegacao

**Status:** concluida
**Papel e objetivo:** corretor Lite abre listas de leads, plantoes, retornos e
desempenho em paginas de trabalho; supervisor Lite abre equipe, leads, placar e
plantoes da propria equipe. Jack continua como o unico assistente em modo conversa.

## Decisao e escopo

- A solicitacao de produto de 2026-10-17 aprova `/agenda` como a pagina canonica
  dos retornos e tarefas datadas do corretor Lite (DEC-148). Esta e a decisao que
  faltava para a recomendacao antiga de nao criar `/tarefas`.
- Links novos e aliases legados do assistente apontam para rotas dedicadas e
  autorizadas por papel/experiencia Lite.
- `/agenda` reutiliza `light-dashboard/agenda.tsx` e as Server Actions ja usadas
  pelo chat: concluir, cancelar com desfazer e reagendar.
- `/desempenho` projeta os indicadores de hoje e a meta ja carregados pelo
  workspace do corretor.
- `/equipe/plantao` reaproveita `TeamOnDutyList` e a consulta escopada da equipe do
  supervisor. A disponibilidade do corretor passa a ter controles reais na pagina
  de plantao.
- Nenhuma regra da rota `/leads/` sera alterada nesta frente; ela pertence a Frente B.

## Estados e proxima acao

- Agenda: itens em aberto, vazio, acao em andamento, sucesso/erro, reagendamento e
  desfazer cancelamento.
- Desempenho: indicadores diarios, meta presente/ausente e atalhos para leads e
  plantoes.
- Plantao da equipe: lista do dia ou vazio; cada corretor abre o proprio plantao.
- Meu plantao: ativo/pausado/aguardando, pausa/retomada, confirmacao e falha
  recuperavel.

## Restricoes visuais e tecnicas

- Usar Arc, componentes compartilhados e tokens existentes, incluindo claro/escuro.
- Nao criar primitive, token, animacao, borda local ou card dentro de card.
- Manter permissoes e escopo no servidor. Todas as mutacoes reutilizam a acao
  autenticada existente, sem fila, distribuicao ou elegibilidade nova.
- Validar 390px e 1440px em tema claro e escuro, Vitest focalizado e `tsc --noEmit`.
  `npm run build` foi explicitamente dispensado para este merge.

## Arquivos previstos

`assistant-scripts.ts`, `supervisor-workspace/chat.ts`, rota legada de assistente,
`components/chat/chat-home.tsx`, `components/light/light-routes.ts`, paginas
`/agenda`, `/desempenho` e `/equipe/plantao`, `DutyNowView`, testes e destinos fixos
que ainda abrem os aliases antigos.

## Entrega e verificacao

- Navegacao de broker e supervisor, aliases legados, Agenda interativa e controles
  de disponibilidade em `/plantoes/agora` foram implementados. `/equipe/plantao`
  importa `TeamOnDutyList` sem alterar o componente compartilhado.
- Vitest focado: 11 arquivos e 90 testes passaram.
- TypeScript: `npx next typegen` gerou as rotas atuais e `npx tsc --noEmit
  --project .next/tsconfig-lite-nav-check.json` passou sem erros. O script padrao
  apontou apenas imports obsoletos da pagina temporaria removida em
  `.next/dev/types`; a configuracao de verificacao excluiu essa pasta gerada e
  manteve o restante da configuracao do projeto.
- `npm run build` nao foi executado conforme solicitado.
- A matriz visual 390/1440 em claro/escuro nao pode ser concluida: o preview local
  falhou ao compilar pela ligacao de `node_modules` externa a raiz da worktree.
