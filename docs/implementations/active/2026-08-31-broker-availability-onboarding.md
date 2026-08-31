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

## Validações

- `npx tsc --noEmit`
- `npm run agent:verify -- --level fast`
- `npm run build`
