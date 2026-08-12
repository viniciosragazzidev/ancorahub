# Integrações nativas Meta Tech Provider

## Objetivo

Permitir que o Diretor conecte Marketing/Lead Ads e WhatsApp diretamente na interface do CRM, sem inserir token manualmente e sem compartilhar credenciais entre os dois produtos Meta.

## Escopo e arquivos

- OAuth de Marketing com state hash de uso único em `meta_connection_attempts`.
- Callback seguro para `lead-ads/callback`, com retorno ao mesmo origin e troca de código somente no servidor.
- Assinatura de `leadgen` e busca de leads usando a credencial cifrada do tenant.
- Embedded Signup nativo de WhatsApp, com validação de origem e IDs retornados pela sessão Meta.
- Migração `0117_meta_connection_attempts.sql` e pesquisa operacional em `docs/research/2026-08-12-meta-tech-provider-native-onboarding.md`.

## Decisões

- DEC-074. Marketing e WhatsApp permanecem conectores independentes.
- O Super-admin continua controlando as capacidades globais existentes; o Diretor apenas configura a conexão do próprio tenant.

## Validações

- `npm run type-check`
- `npx vitest run src/features/meta-ads/meta-connection-attempts.test.ts src/features/communication-channels/meta-cloud-client.test.ts src/features/communication-channels/meta-lead-ads.test.ts`
- `npm run agent:verify -- --level fast`
- `npm run build`

## Riscos e rollback

Se for necessário reverter, desative a capacidade Meta/Lead Ads no Super-admin e desconecte o tenant. A migração só adiciona uma tabela de tentativas efêmeras, sem alterar leads, mensagens ou canais existentes. A configuração manual anterior pode ser mantida enquanto a homologação Meta não estiver concluída.
