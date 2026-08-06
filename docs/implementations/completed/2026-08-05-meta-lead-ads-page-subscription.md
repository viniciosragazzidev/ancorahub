# Inscrição automática da Página Meta Lead Ads

## Objetivo

Associar o aplicativo Corretop API Oficial à Página Meta no momento da ativação, para que eventos de formulário `leadgen` possam chegar ao webhook do AncoraHub.

## Escopo entregue

- `subscribePageToLeadgen` envia `POST /{page-id}/subscribed_apps` com `subscribed_fields=leadgen`, sempre pelo servidor e com a credencial técnica central.
- A confirmação em `/settings/meta` reinscreve cada Página descoberta antes de criar ou reativar a fonte local.
- Se a Meta recusar a inscrição, a fonte não é persistida nem marcada como ativa.
- O guia do Diretor separa o compartilhamento da Página da etapa técnica da Ancora Hub.

## Decisões

- DEC-069 e DEC-070 foram consultadas.
- DEC-071 registra que a confirmação local depende da inscrição externa aceita pela Meta.
- O Diretor continua sem acesso a token, App Secret ou demais segredos.

## Validações

- `npm test -- --run src/features/communication-channels/meta-cloud-client.test.ts` — 4 testes aprovados, incluindo inscrição aceita e inscrição recusada.
- `npm run agent:verify -- --level fast` — documentação válida, type-check e 247 testes aprovados.
- `npm run agent:verify -- --level full` foi iniciado, mas excedeu o limite local de 124 segundos durante as verificações completas; o build de produção na Vercel será a confirmação adicional da entrega.

## Riscos e rollback

- A Meta pode recusar a inscrição quando o token técnico não possuir `pages_manage_metadata`; nesse caso o CRM mostra o erro e não ativa a Página.
- Para interromper novos recebimentos, o Diretor pausa a fonte em `/settings/meta`; o histórico é preservado.
- O rollback de código remove a chamada de inscrição sem apagar fontes ou leads existentes.
