# Separação do número oficial do WhatsApp

## Entrega

`/integrations/meta` passa a concentrar apenas o Marketing Meta: perfil
empresarial, Páginas, contas de anúncios, pixels, fontes, formulários e
sincronizações. O WhatsApp oficial permanece em `/integrations/whatsapp`, com
uma jornada própria para conectar, pausar, reativar e desconectar o número
corporativo.

## Regras preservadas

- O tenant, o papel e a autorização são derivados da sessão no servidor.
- Apenas o Diretor pode alterar o canal oficial.
- Há somente um número oficial ativo por tenant; a troca exige desconectar o
  número atual primeiro.
- Desconectar revoga a credencial cifrada no CRM, preserva histórico e auditoria
  e não altera Páginas, campanhas, contas de anúncios, pixels ou fontes.
- Marketing e WhatsApp seguem com tokens e ciclos de autorização independentes.

## Arquivos principais

- `src/features/communication-channels/actions.ts`
- `src/features/communication-channels/components/meta-cloud-setup-card.tsx`
- `src/features/communication-channels/components/meta-embedded-signup-card.tsx`
- `src/app/(dashboard)/settings/whatsapp-page.tsx`
- `src/app/(dashboard)/integrations/meta/page.tsx`
- `src/features/communication-channels/components/meta-integration-hub.tsx`
- `src/features/meta-ads/actions.ts`
- `src/features/meta-ads/components/meta-integration-view.tsx`

## Rollback

Reverter os arquivos desta entrega restaura a composição anterior. A
desconexão de um número é reversível pela nova conexão via Embedded Signup; o
histórico não é apagado.

## Validações

- Testes de interface para os controles do número oficial e para o perfil de
  ativos de Marketing Meta.
- `npm run agent:verify -- --level full`: 80 arquivos e 326 testes aprovados.
- `npm run build`: aprovado.
- Contratos de webhook para Lead Ads e WhatsApp agora exigem HMAC válido; os
  contratos de OAuth, `leadgen`, intake idempotente e envio de template pelo
  número oficial também foram validados.
- `npm run db:check`, `npm run db:migrate` (inclusive reexecução idempotente)
  e `npm run db:check-meta-connection` passaram. Esta última usa transação
  revertida para verificar a tabela de tentativas Meta.
- `npm run agent:verify -- --level fast`: 82 arquivos e 333 testes aprovados;
  build de produção aprovado em 13/08/2026.
- `/qualificacao` deixou de executar DDL no carregamento. A estrutura do Hub
  está na migration `0118_qualification_hub_persistence.sql`, já aplicada.
- O lint global continua bloqueado exclusivamente por arquivos externos já
  existentes fora deste escopo; type-check, segurança e build não apontaram
  falhas da entrega.
- O retorno do Embedded Signup v4 aceita o evento seguro `WA_EMBEDDED_SIGNUP` tanto como objeto quanto como JSON serializado, formato usado pelo pop-up hospedado da Meta. O fluxo encerra o estado de carregamento ao concluir, cancelar, falhar ou exceder 90 segundos e evita dupla conclusão quando código e dados chegam em eventos distintos.
- A configuração pública de produção usa o `config_id` v4 `2285077245657163`, exclusivo do canal WhatsApp e sem relação com os ativos de Marketing Meta.
