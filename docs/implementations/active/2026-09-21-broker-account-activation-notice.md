# Confirmação de conta ativa após primeiro acesso

## Escopo

Após a conclusão transacional do primeiro acesso, o CRM enfileira uma mensagem
de confirmação com o link de login. A ativação da conta não depende do provedor
de WhatsApp.

## Decisões aplicadas

- O evento `brokerAccountActivated` foi adicionado ao catálogo de mensagens e
  aparece em `/qualificacao?tab=meta_templates`.
- Existe uma mensagem livre padrão com `nome`, `empresa` e `login_url`; o
  Super-admin pode desligar o comportamento por
  `feature_broker_account_activation_notice_enabled`.
- O outbox usa a mesma `channelId` e o mesmo `destinationPhone` do convite
  original, com idempotência por tenant e convite.
- O worker não troca o canal de uma mensagem de ativação se ele estiver
  inativo ou ausente; o estado é auditado como indisponível.
- Quando uma política ativa escolher mensagem livre fora da janela da Meta, o
  resolvedor exige o template Meta aprovado configurado como contingência,
  respeitando DEC-092/DEC-111.
- O nome convencional do template Meta de contingência é
  `broker_account_activated`; ele só é usado depois de aparecer sincronizado e
  aprovado para a WABA do tenant.

## Arquivos principais

- `src/app/primeiro-acesso/onboarding-actions.ts`
- `src/features/team/broker-account-activation-delivery.ts`
- `src/features/communication-channels/message-event-catalog.ts`
- `src/features/communication-channels/message-policy-service.ts`
- `src/features/communication-channels/outbound-service.ts`
- `src/features/communication-channels/templates.ts`

## Validação

- Testes focados de catálogo, outbox e templates: aprovados.
- `npm run type-check`: única falha preexistente em
  `scripts/_tmp-diag2.ts` (`p.userId` possivelmente nulo), arquivo não
  relacionado e já presente antes da alteração.
- Ainda pendentes nesta etapa: `agent:verify --level full` e build de produção.

## Rollback

Desligar a flag global interrompe novas notificações sem reverter contas já
ativadas. Para rollback de código, remova o pós-commit do onboarding e preserve
as linhas existentes da outbox para auditoria.
