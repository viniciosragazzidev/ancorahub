# Onboarding de disponibilidade do corretor

## Objetivo

Fazer com que cada corretor declare, ao menos uma vez, a agenda em que aceita
novos leads. A agenda passa a proteger a distribuição automática sem impedir
gestores e diretores de fazerem uma atribuição manual consciente.

## Escopo entregue

- tabela `broker_availability_windows`, isolada por tenant e corretor;
- onboarding bloqueante após o primeiro acesso, com agenda obrigatória;
- etapa de WhatsApp pessoal detecta desktop e orienta a conexão como recomendada,
  sem bloquear a entrada no CRM;
- edição posterior em `/settings?tab=disponibilidade`;
- `chooseAvailableBroker` filtra por agenda no fuso America/Sao_Paulo antes de
  aplicar plantão e carga;
- kill switch global auditado em `/super-admin/settings`.

## Segurança e regra operacional

A identidade, tenant e papel são derivados exclusivamente da sessão. O corretor
somente altera a própria agenda; a gravação valida horários, dias e sobreposição,
e registra auditoria sem dados pessoais. A distribuição manual não consulta essa
restrição, conforme DEC-088.

## Riscos e rollback

Com a flag ativa, corretor sem janela não recebe atribuição automática até concluir
o onboarding. Em caso de contingência, o Super-admin desativa
`feature_broker_availability_onboarding_enabled`; os dados e a auditoria são
preservados e a seleção volta aos critérios anteriores.

## Incidente de compatibilidade (31/08)

A migration `0140_add_broker_availability_windows.sql` já existia no repositório,
mas estava ausente do catálogo `drizzle/meta/_journal.json`, que é a fonte usada pelo
executor controlado `npm run db:migrate`. Como o carregador compartilhado do corretor
consulta a agenda ao renderizar o shell, a ausência da tabela produzia `42P01` em
todas as rotas desse papel. A migration foi registrada no catálogo e a leitura agora
trata exclusivamente essa tabela ausente como capacidade temporariamente indisponível,
sem derrubar o restante do CRM. A migration deve ser aplicada uma vez no banco de
produção pelo passo controlado antes de reativar o onboarding.

## Validações

- `npx tsc --noEmit`
- `npm run agent:verify -- --level fast`
- `npm run build`
