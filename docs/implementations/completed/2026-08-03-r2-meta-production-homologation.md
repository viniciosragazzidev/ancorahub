# Homologação de produção: R2 e Meta Lead Ads

## Objetivo

Validar o bucket privado Cloudflare R2 e a prontidão do piloto de Meta Lead Ads
com dados sintéticos, sem expor credenciais ou dados pessoais.

## Resultado

- R2 em produção foi validado com um objeto sintético temporário: escrita, leitura,
  checksum e remoção foram bem-sucedidos. O objeto foi removido ao fim do teste.
- As quatro variáveis privadas do R2 e as três do Meta Lead Ads estão configuradas
  no Vercel em produção.
- Os controles globais `feature_r2_storage_enabled` e
  `feature_meta_lead_ads_enabled` estão ativos. A empresa `ancora-corretora-teste`
  existe, está ativa e pertence ao piloto configurado.
- O webhook Meta em produção respondeu `403` para token de verificação inválido, o
  que confirma que sua configuração privada foi carregada pelo runtime. A assinatura
  HMAC e a normalização de payload também permanecem cobertas por testes unitários.

## Limite encontrado

A empresa piloto ainda não possui uma fonte `meta_lead_ad_sources` nem uma Página e
formulário de teste compartilhados com a plataforma. Sem esse ativo externo não é
possível disparar, com segurança, a etapa final de descoberta, criação de Lead Ads e
verificação idempotente do webhook. Nenhuma Página, campanha ou dado externo foi
inventado ou alterado.

## Próximo passo manual

Um administrador da Página de teste deve compartilhá-la com a Ancora Hub, liberar o
aplicativo Corretop API Oficial em Acesso a Leads e criar/selecionar um formulário de
teste. Em seguida, o Diretor da empresa piloto pode usar `/settings/meta` para ativar
a Página e gerar um lead sintético na ferramenta oficial de testes da Meta.

## Validação

- `npm run test -- --run src/shared/storage/r2-storage.test.ts src/features/communication-channels/meta-lead-ads.test.ts` — 5 testes aprovados.
- `npm run type-check`
- `npm run agent:verify -- --level fast` — 55 arquivos e 231 testes aprovados.
- Evidência: `reports/agent/verification/2026-08-03T18-57-54.423Z.md`.

## Segurança

Nenhuma chave, token, ID completo de ativo, pessoa ou conteúdo de documento foi
registrado. O arquivo temporário e o arquivo temporário de ambiente foram removidos.
