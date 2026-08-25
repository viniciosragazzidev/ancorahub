# CRM Next.js em staging no Coolify

## Objetivo

Preparar um deploy isolado do CRM em `staging.crm.ancorasaude.cloud` para validar a
execução self-hosted do Next.js antes de qualquer migração de produção.

## Escopo desta etapa

- gerar imagem Docker com `output: "standalone"`;
- iniciar o servidor Next na porta interna `3000`;
- permitir que Better Auth use a origem configurada do staging;
- usar a branch isolada e vazia do Supabase para homologação, sem copiar dados de
  produção;
- documentar variáveis, healthcheck, rollback e isolamento de dados.

## Fora do escopo

- troca do domínio de produção;
- desligamento ou alteração da Vercel;
- webhook Meta, relay WAHA, WhatsApp oficial, VPS, R2 ou cron de produção;
- cópia de dados de produção para staging;
- execução automática de migrations.

## Contratos de segurança

- a origem de autenticação vem somente de configuração server-side;
- `NEXT_PUBLIC_*` contém apenas valores intencionalmente públicos;
- segredos e conexões externas reais não são cadastrados no ambiente inicial;
- o banco de staging recebe somente dados sintéticos;

## Rollout e rollback

O rollout depende de configurar a aplicação Coolify para a branch
`codex/coolify-staging`, domínio de staging e variáveis isoladas. Se a validação
falhar, a aplicação é parada no Coolify. A Vercel continua atendendo a produção.

## Validação executada e pendente no ambiente-alvo

Em 25/08/2026, o `package-lock.json` foi sincronizado com o `package.json` após o
primeiro build do Coolify identificar entradas ausentes do `esbuild`. A verificação
`npm ci --dry-run --ignore-scripts` foi concluída com sucesso.

O Docker Desktop local não está disponível nesta estação. O build, o teste focado de
autenticação, o healthcheck e a validação de login serão executados no primeiro deploy
controlado do Coolify, que é o ambiente-alvo desta etapa.
