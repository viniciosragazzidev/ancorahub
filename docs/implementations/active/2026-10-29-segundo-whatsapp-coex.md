# Segundo número WhatsApp em coexistência

## Estado

Onda 1 entregue; onda 2 em implementação. Pedido aprovado por Vinicios em 2026-10-29. Não inclui mudança de schema ou migration.

## Decisões e escopo

- Cada canal conserva sua configuração de entrada. Contato novo pode ser criado na fila do número que recebeu a mensagem.
- Lead ou cliente conhecido conserva o registro existente; lead conhecido também conserva a fila original.
- Coex nunca é `isDefault`. Avisos internos e templates para usuários escolhem o canal oficial padrão.
- `PARTNER_REMOVED` desativa somente o canal correspondente a `phone_number_id`, ou ao sufixo único de oito dígitos do telefone quando o ID não vier. Sem correspondência, registra log e não altera canais.
- Respostas ao cliente usam o canal da mensagem inbound mais recente. Se a origem estiver indisponível ou sem credencial, o envio falha sem fallback e a conversa orienta a reconexão.
- Sem canal de origem associado, o seletor escolhe fallback oficial pela prioridade de padrão, criação mais antiga e ID.

## Entregue

### Onda 1 entregue

- Cadastro de coexistência escolhe somente números ainda não conectados e retorna erro claro quando não existe número disponível.
- A seleção de número e a regra de `isDefault` estão isoladas em funções puras.
- A configuração Coex continua visível mesmo que registros legados tenham `isDefault` ligado; a seleção do canal corporativo ignora Coex.
- O intake roteia contatos novos por canal e preserva lead/fila de contato conhecido.
- `PARTNER_REMOVED` não desativa canais sem correspondência; registra evento não associado.

### Onda 2 em implementação

- Resolvedor tenant-scoped compartilhado por envio direto, enqueue de template/texto e worker de outbox.
- Avisos internos sempre ignoram canais Coex e usam o fallback oficial determinístico.
- A ausência ou indisponibilidade da origem inbound bloqueia resposta automática e manual ao cliente, com orientação exibida na conversa. O envio de mídia segue a mesma validação no servidor.

## Arquivos e fluxos principais

- `src/features/communication-channels/actions.ts`
- `src/features/communication-channels/channel-lead-intake.ts`
- `src/features/communication-channels/meta-coexistence-events.ts`
- `src/features/communication-channels/meta-coexistence-ingest.ts`
- `src/features/communication-channels/meta-channel-routing-domain.ts`
- `src/features/communication-channels/meta-channel-router.ts`
- `src/features/communication-channels/service.ts`
- `src/features/communication-channels/outbound-service.ts`
- `src/features/ai-qualification/service.ts`
- `src/features/leads/actions/send-lead-message.ts`
- `src/features/leads/actions/send-lead-media.ts`
- `src/app/(dashboard)/integrations/whatsapp/page.tsx`
- `src/app/(dashboard)/settings/whatsapp-page.tsx`
- `src/app/(dashboard)/conversas/page.tsx` e `conversations-workspace.tsx`

## Validação

- Testes unitários puros cobrem intake por número, dedupe de lead conhecido, seleção de canal, bloqueio por origem inativa/sem token, fallback estável, Coex fora de `isDefault`, `PARTNER_REMOVED` e ausência de número novo.
- Vitest focado, `tsc --noEmit` e ESLint serão registrados após execução. Testes de banco e migrations não fazem parte da validação.
- Validação manual M1 a M4 na Meta permanece pendente e requer número de teste autorizado.

## Fora de escopo e riscos

- Limites por WABA, validade/renovação de token, índice de telefone do webhook e janela histórica da aba Coex não foram medidos nem alterados.
- Nenhum acesso ou alteração ao banco de produção foi realizado.
