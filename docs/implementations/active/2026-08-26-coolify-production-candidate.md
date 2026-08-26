# Candidato de producao no Coolify

## Objetivo

Preparar uma imagem self-hosted do CRM a partir da branch `redesign`, preservando o
ambiente de staging existente e sem alterar dominio, DNS, webhooks, banco ou jobs de
producao nesta etapa.

## Escopo tecnico

- habilitar `output: "standalone"` do Next.js;
- adicionar Dockerfile multi-stage e `.dockerignore` usados pelo Coolify;
- incluir `curl` na imagem final para o healthcheck HTTP do Coolify.

## Validacao e rollback

- `npm@10.9.8 ci --dry-run --ignore-scripts` aceitou o lockfile sincronizado;
- o build e o healthcheck serao validados pelo candidato isolado no Coolify;
- rollback: manter o staging e a Vercel sem alteracao, removendo apenas o candidato
  se a homologacao falhar.

## Fora do escopo

- apontar `crm.ancorasaude.cloud`;
- migrations, cron, Meta, WhatsApp, VPS, R2 ou dados operacionais.
