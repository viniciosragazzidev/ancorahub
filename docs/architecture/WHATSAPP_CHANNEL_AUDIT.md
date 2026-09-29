# Auditoria de canais WhatsApp

Data: 2026-09-11

## Decisão de separação

`/integrations/whatsapp` é o canal Meta Cloud API oficial. `/integrations/whats_alt` é o canal WAHA alternativo. A seleção de um canal não deve produzir fallback silencioso para o outro.

## Inventário atual

| Área | Classificação | Observação |
| --- | --- | --- |
| `src/features/communication-channels/*` | META_ONLY / SHARED_CONTRACT | Templates, políticas e executor Meta; contratos de evento podem ser compartilhados somente quando neutros. |
| `src/features/waha-cadence/*` | WAHA_ONLY | Cadências, relay, outbox, webhook e conexões WAHA. |
| `src/features/waha-cadence/relay-client.ts` | WAHA_ONLY | Único cliente de transporte WAHA identificado. |
| `src/app/api/webhooks/meta/*` | META_ONLY | Webhooks oficiais Meta. |
| `src/app/api/webhooks/waha/*` e `openwa/*` | WAHA_ONLY / LEGACY | Recepção e compatibilidade de sessões WAHA. |
| `src/app/(dashboard)/integrations/whatsapp/page.tsx` | META_ONLY | Agora renderiza somente a configuração Meta. |
| `src/app/(dashboard)/integrations/whats_alt/page.tsx` | WAHA_ONLY | Nova entrada visual para conexão WAHA. |
| `src/components/whatsapp/*` | MIXED_PROVIDER | Componentes de conexão ainda dependem das actions legadas e devem ser migrados para `whats-alt` em etapa posterior. |
| `src/features/communication-channels/outbound-service.ts` | MIXED_PROVIDER | Executor oficial Meta e fallback interno existente; não deve ser usado por mensagens WAHA novas. |

## Riscos encontrados

- O componente legado `WahaConnectionsCard` ainda usa `waha-cadence/connection-service`; ele foi movido de tela, mas ainda não é um Domain Root próprio.
- A tabela/outbox `whatsappOutboundMessages` pertence ao fluxo oficial e não deve receber campanhas WAHA.
- Webhooks WAHA antigos permanecem ativos por compatibilidade e precisam de migração individual antes de remoção.

## Próxima etapa autorizada

Criar `src/features/communication/whats-alt/` com configuração, autorização, audience resolver, dispatcher e fila próprios. Até essa etapa, a nova rota limita-se a conexão/status WAHA e não cria envio em massa nem reutiliza o executor Meta.

## Critério de isolamento

O desligamento de Meta não deve impedir a conexão WAHA, e o desligamento de WAHA não deve alterar o executor ou os webhooks Meta.
