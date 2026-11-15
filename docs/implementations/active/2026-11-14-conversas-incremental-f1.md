# Conversas com sincronização incremental · F1

Data: 14/11/2026
Plano de origem: `C:/Users/kyper/brain/projetos/crm-ancora/decisoes/2026-11-14-plano-reparo-egress.md`
Worktree: `ancorahub-egress-conversas` · branch `fix/egress-conversas-incremental`

## Entrega

- A página inicial monta a lista em SQL com uma prévia compacta e agregados por conversa. As mensagens completas e metadados de mídia são carregados apenas para a conversa aberta.
- `POST /api/conversations/incremental` autentica pela sessão, deriva tenant e escopo no servidor, aplica os filtros compartilhados e lê deltas ordenados por `sent_at, id`. Atualiza prévias e contadores por conversa; para a conversa aberta, inclui as novas mensagens e os status de entrega.
- Conversas sem lead também são validadas por telefone, tenant e regras de classificação existentes, incluindo atualização do chat aberto.
- O cliente mescla deltas sem substituir o perfil, tags, documentos ou contexto local. Contadores somam somente mensagens posteriores ao cursor; o status da IA é mesclado por conversa sem carregar resumo/modelo junto com o delta.
- Realtime deixa de chamar `router.refresh()` em cada evento de conversas. Com o realtime ativo e sinais chegando, não há refresh integral periódico; ele ocorre após 10 minutos sem sinais, com o realtime fora, erro/fallback do delta ou mudança de escopo. O provider mantém `scheduleServerRefresh` para os demais domínios, inclusive conexão do WhatsApp em `/conversas`. A aba de conversas oficiais do corretor continua usando o fluxo anterior.

## Comportamento preservado

Tenant, papel e escopo são revalidados no endpoint. A consulta inicial e a incremental usam os mesmos filtros para Status, linhas `[text]` sem mídia e histórico de coexistência anterior à ativação. Associação por telefone só considera mensagens sem `lead_id`; mensagens ligadas a outro lead nunca entram na prévia/contagem pela coincidência do telefone. Os limites de leads continuam em 800 para diretor e 250 para os demais; a lista de IDs do delta é limitada a 800 e prioriza a conversa aberta. Contagens incrementais usam `count`/`bool_or` sem corpo; o corpo truncado sai apenas na linha mais recente por conversa (`distinct on`). Leads, documentos e alterações de canal que não são mensagens continuam reconciliados pela recarga integral de segurança.

## Correções da segunda revisão

- O cursor inicial agora vem da mesma consulta SQL que calcula as prévias e contagens. A consulta escolhe o maior par `(date_trunc('milliseconds', sent_at), id)` entre as mensagens que entraram nos agregados; para índice vazio, usa o horário de início da instrução com ID vazio. Mensagens da conversa aberta só avançam o cursor quando são a fonte do contador de fallback daquela conversa.
- O endpoint compara e ordena mensagens por `date_trunc('milliseconds', sent_at), id`, inclusive no resumo agregado e no histórico aberto. Assim, o ISO em milissegundos não faz a última mensagem voltar no próximo delta.
- `ai_conversations.updated_at` existe no schema. O delta consulta status atualizado depois do cursor para os leads carregados, incluindo mudanças para atendimento humano sem nova mensagem. O cursor continua sendo orientado por mensagens; um status de IA silencioso pode ser reenviado em outro delta enquanto nenhuma mensagem posterior avançar o cursor.
- Erros de transporte do delta acionam recarga integral no máximo uma vez por minuto.

## Correções da terceira revisão

- O F1 foi rebaseado sobre a origin que já contém F0 e F5. `/conversas` não usa mais `useVisibleRealtimeRefresh`: sinal de conversa agenda apenas `POST /api/conversations/incremental`. O provider de F5 continua definindo `document.documentElement.dataset.realtimeLive`; seu roteamento, resumo limitado a um por minuto e rail foram preservados. `use-visible-realtime-refresh.ts` segue em uso pelo workspace Lite do corretor, com `timingRef` mantido.
- Resposta não OK, JSON inválido ou payload delta inválido usam o limite de uma recarga integral por 60 segundos. `409` com `requiresFullRefresh` segue imediato e sem limite.
- A ordenação da conversa aberta e a escolha da última prévia usam `Date.getTime()` diretamente.
- Limitação aceita: uma mudança de status da IA sem mensagem não gera sinal incremental; aparece no próximo refresh completo, que ocorre após até 10 minutos sem sinais quando o realtime está ativo. Uma nova mensagem pode adiantar a reconciliação pelo delta.

## Limites e validação

A primeira versão do endpoint cobre as conversas que já estão na lista atual. Permanecem conhecidas: (1) mensagem retroativa com `sent_at` anterior ou igual ao cursor não entra no delta; (2) a lista permanece limitada aos 800 IDs enviados pelo cliente, então itens fora desse recorte só entram na recarga integral. O cursor continua serializado em ISO de milissegundos, mas a comparação e o desempate usam a mesma precisão e `id`. Mais de 500 mensagens no delta, mais de 300 mensagens novas na conversa aberta, mudança de escopo, cursor vencido ou erro de contrato acionam a recarga integral. Não foi feita medição de egress em produção nem leitura/escrita no banco nesta tarefa.

Verificação focada: `npx vitest run 'src/app/(dashboard)/conversas' src/features/conversations src/components/providers src/app/api/conversations` (15 arquivos, 78 testes), `npx tsc --noEmit` e build `npx next build --webpack` aprovados. `npm run build` com Turbopack falhou antes da compilação porque o junction `node_modules` aponta para fora da raiz da worktree. Resultados: `reports/agent/verification/2026-11-14-egress-conversas-f1.md` (artefato local ignorado pelo Git).
