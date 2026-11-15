# Conversas com sincronização incremental · F1

Data: 14/11/2026
Plano de origem: `C:/Users/kyper/brain/projetos/crm-ancora/decisoes/2026-11-14-plano-reparo-egress.md`
Worktree: `ancorahub-egress-conversas` · branch `fix/egress-conversas-incremental`

## Entrega

- A página inicial monta a lista em SQL com uma prévia compacta e agregados por conversa. As mensagens completas e metadados de mídia são carregados apenas para a conversa aberta.
- `POST /api/conversations/incremental` autentica pela sessão, deriva tenant e escopo no servidor, aplica os filtros compartilhados e lê deltas ordenados por `sent_at, id`. Atualiza prévias e contadores por conversa; para a conversa aberta, inclui as novas mensagens e os status de entrega.
- Conversas sem lead também são validadas por telefone, tenant e regras de classificação existentes, incluindo atualização do chat aberto.
- O cliente mescla deltas sem substituir o perfil, tags, documentos, estado de IA ou outros dados locais. IDs desconhecidos e cursores vencidos pedem uma recarga completa.
- Realtime deixa de chamar `router.refresh()` em cada evento de conversas. O chat aberto faz reconciliação leve; a página mantém recarga integral a cada 2 minutos, ao voltar de uma aba oculta por 2 minutos ou quando o cursor/delta exige fallback. A aba de conversas oficiais do corretor continua usando o fluxo anterior.

## Comportamento preservado

Tenant, papel e escopo são revalidados no endpoint. A consulta inicial e a incremental usam os mesmos filtros para Status, linhas `[text]` sem mídia e histórico de coexistência anterior à ativação. Os limites de leads continuam em 800 para diretor e 250 para os demais; a lista de IDs do delta é limitada a 800 e prioriza a conversa aberta. Contadores e filtro de atendente virtual usam agregados SQL. Leads, documentos, IA e alterações de canal que não são mensagens são reconciliados pela recarga integral de segurança.

## Limites e validação

A primeira versão do endpoint cobre as conversas que já estão na lista atual. Uma conversa nova fora dessa lista, mudanças de lead/documento/IA e sinais perdidos são reconciliados em até 2 minutos. Mais de 500 mensagens no delta, mais de 300 mensagens novas na conversa aberta, mudança de escopo, cursor vencido ou erro de contrato acionam a recarga integral. Não foi feita medição de egress em produção nem leitura/escrita no banco nesta tarefa.

Verificação focada: `npx vitest run 'src/app/(dashboard)/conversas' src/features/conversations src/components/providers/realtime-sync-provider.test.ts` e `npx tsc --noEmit`. O harness integral não faz parte deste recorte. Resultados registrados em `reports/agent/verification/2026-11-14-egress-conversas-f1.md` (artefato local ignorado pelo Git).
