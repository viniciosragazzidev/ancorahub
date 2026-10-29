# Segundo número WhatsApp em coexistência

## Estado

Ondas 1 e 2 concluídas em 2026-10-29. Pedido aprovado por Vinicios. Não inclui mudança de schema ou migration.

## Decisões e escopo

- Cada canal conserva sua configuração de entrada. Contato novo pode ser criado na fila do número que recebeu a mensagem.
- Lead ou cliente conhecido conserva o registro existente; lead conhecido também conserva a fila original.
- Coex nunca é `isDefault`. Avisos internos e templates para usuários escolhem o canal oficial padrão.
- `PARTNER_REMOVED` desativa somente o canal correspondente a `phone_number_id`, ou ao sufixo único de oito dígitos do telefone quando o ID não vier. Sem correspondência, registra log e não altera canais.
- Respostas ao cliente usam o canal da mensagem inbound mais recente. Se a origem estiver indisponível ou sem credencial, o envio falha sem fallback e a conversa orienta a reconexão.
- Sem canal de origem associado, o seletor escolhe fallback oficial pela prioridade de padrão, criação mais antiga e ID.
- O resolvedor devolve bloqueio tipado para origem indisponível. A conversa mostra a orientação de reconexão; IA e outbox registram o bloqueio sem trocar de número nem derrubar o fluxo.
- A busca da origem inbound usa leadId/clientId quando disponível e limita toda consulta a 30 dias; só conversas sem vínculo usam correspondência de telefone, também limitada.
- Ao reconectar um canal oficial não padrão, ele se torna padrão quando o tenant não tem outro canal oficial padrão. Essa restauração é intencional; Coex continua fora do padrão.
- Tenant com somente canais Coex permanece sem canal oficial para avisos internos. Não usar Coex como fallback é intencional; é preciso conectar um canal oficial para reativar esses envios.

## Entregue

### Onda 1 entregue

- Cadastro de coexistência escolhe somente números ainda não conectados e retorna erro claro quando não existe número disponível.
- A seleção de número e a regra de `isDefault` estão isoladas em funções puras.
- A configuração Coex continua visível mesmo que registros legados tenham `isDefault` ligado; a seleção do canal corporativo ignora Coex.
- O intake roteia contatos novos por canal e preserva lead/fila de contato conhecido.
- `PARTNER_REMOVED` não desativa canais sem correspondência; registra evento não associado.

### Onda 2 entregue

- Resolvedor tenant-scoped compartilhado por envio direto, enqueue de template/texto e worker de outbox.
- Avisos internos sempre ignoram canais Coex e usam o fallback oficial determinístico.
- A ausência ou indisponibilidade da origem inbound bloqueia resposta automática e manual ao cliente, com orientação exibida na conversa. O envio de mídia segue a mesma validação no servidor.
- O roteador usa leadId/clientId para conversas vinculadas, reduzindo a busca histórica por telefone. Consultas sem vínculo também têm janela de 30 dias e usam o índice de tenant/data existente.

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

- Vitest nas áreas `communication-channels`, `ai-qualification`, `ai-agent` e `conversas`: 61 arquivos e 452 testes aprovados com `--maxWorkers=1`; `npx tsc --noEmit -p .` aprovado; ESLint sem erros, com 11 avisos preexistentes fora do escopo.
- `npm run agent:docs` aprovado com 18 referências verificadas. O relatório está em `reports/agent/verification/2026-10-29-whatsapp-coex.md`.
- Nenhum teste `*.db.test.ts`, migration, build ou acesso ao banco foi executado. M1 a M4 na Meta permanecem pendentes e requerem número de teste autorizado.

## Fora de escopo e riscos

- Limites por WABA, validade/renovação de token, índice de telefone do webhook e janela histórica da aba Coex não foram medidos nem alterados.
- Nenhum acesso ou alteração ao banco de produção foi realizado.
