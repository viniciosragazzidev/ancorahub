# Fluxo mínimo operacional do CorreTop

Este documento define o caminho que precisa funcionar antes de considerar a primeira operação utilizável.

## Fluxo pronto

1. Um lead entra pelo formulário manual ou pelo webhook autenticado do tenant.
2. O sistema resolve a filial de origem. No webhook, quando a origem não informa filial, usa a primeira filial ativa.
3. O distribuidor procura corretores da filial que estejam ativos, com membership ativa e disponibilidade `available`.
4. Entre os elegíveis, escolhe quem tem a menor quantidade de leads em atendimento. Em empate, usa a data de criação para manter uma distribuição estável.
5. O lead recebe o status `distributed` e uma interação de sistema. Sem corretor elegível, permanece `new` com responsável vazio para a fila de distribuição.
6. O corretor vê o lead, inicia o atendimento no detalhe e o sistema muda o status para `in_contact`, registra a interação e abre `https://wa.me/<telefone>`.
7. O corretor pode pausar ou reativar a própria disponibilidade no dashboard. Leads novos não são enviados para quem está pausado.

## Configuração da fonte externa

Gere um token por fonte/filial com `scripts/generate-webhook-credential.ts`, definindo:

```powershell
$env:WEBHOOK_TENANT_ID="..."
$env:WEBHOOK_BRANCH_ID="..."
$env:WEBHOOK_CREDENTIAL_NAME="Landing page - Filial Centro"
$env:WEBHOOK_CREATED_BY_USER_ID="..."
npx tsx scripts/generate-webhook-credential.ts
```

Envie os leads para `POST /api/webhooks/leads` com `Authorization: Bearer <token>` e `Content-Type: application/json`:

```json
{
  "name": "Mariana Costa",
  "phone": "+55 (21) 99999-9999",
  "email": "mariana@example.com",
  "source": "landing_page",
  "externalId": "landing-page-lead-123",
  "planInterest": "Plano empresarial"
}
```

O token é armazenado apenas como hash e a filial vinculada ao token prevalece sobre qualquer filial enviada no payload. A rota antiga `/api/webhooks/leads/:tenantId` continua funcionando para integrações já cadastradas.

## Critérios de aceite do MVP

- O webhook deve responder sucesso apenas depois de persistir o lead e a entrega idempotente.
- Reenvio com a mesma chave de idempotência não pode criar outro lead.
- Um corretor pausado não pode receber novos leads.
- Um lead sem responsável deve aparecer como “Aguardando distribuição” para gestor/diretor.
- Somente o corretor responsável pode iniciar o atendimento pelo WhatsApp.
- O início do atendimento precisa deixar evidência na timeline e no audit log de status.

## Lacunas que ainda impedem uma operação completa

- Reatribuição manual de um lead sem responsável ou de um corretor indisponível.
- Notificação in-app para o corretor quando um lead é atribuído; hoje a atualização depende de refresh/navegação.
- SLA com cron/job para alertar leads não trabalhados e estagnados.
- Integração Meta Cloud API e histórico de mensagens; o fallback atual abre o WhatsApp externo.
- Teste E2E cobrindo webhook → distribuição → início no WhatsApp.

Essas lacunas não bloqueiam o fluxo manual inicial, mas devem ser tratadas antes de aumentar o volume de leads ou prometer atendimento em tempo real.
