# Migração do armazenamento de arquivos para Cloudflare R2

## Objetivo

Substituir o bucket privado do Supabase Storage por um bucket privado do Cloudflare R2. O sistema está em desenvolvimento e não há objetos a copiar.

## Decisão e escopo

- Um único bucket R2 privado guarda todos os binários persistidos. O prefixo `documents/<tenantId>/` é reservado para os documentos já implementados.
- O banco continua sendo a fonte de verdade para metadados, vínculos e autorização. URLs continuam internas; o browser nunca recebe credenciais R2.
- Upload e download passam pelo servidor e preservam validação de tipo/tamanho, checksum, isolamento de tenant, filial/carteira e auditoria existente.
- `feature_r2_storage_enabled` é o kill switch global auditável. Desativá-lo interrompe novas leituras e gravações, sem apagar registros nem objetos.

## Etapas

1. Implementar cliente S3 Signature V4 sem nova dependência e configurar as variáveis privadas do R2.
2. Trocar o adaptador de documentos e manter as rotas públicas internas.
3. Disponibilizar controle do Super-admin, documentação operacional e remover a configuração do Supabase Storage.
4. Validar fluxo sintético de assinatura e o projeto; após configurar as credenciais, validar upload/download autenticado em cada ambiente.

## Rollback

Desative `feature_r2_storage_enabled` para interromper a capacidade. Como não há objetos legados, o rollback de código restaura o adaptador Supabase somente se ainda for necessário antes do primeiro upload R2.

## Riscos conhecidos

- O serviço permanece limitado a 10 MB por documento até uma decisão explícita sobre upload multipart/direto.
- A ativação depende de criar bucket e token R2 privados no painel Cloudflare; segredos não entram no repositório nem no painel do CRM.

## Evidências

- Passou: lint dirigido dos arquivos alterados, teste unitário de assinatura R2 e suíte completa com 228 testes.
- Passou: build de produção em 2026-08-03 antes de alterações não relacionadas no workspace.
- O `agent:verify --level full` validou documentação, escopo, arquitetura, segurança e desempenho. O lint global permanece bloqueado por erros preexistentes fora deste escopo; posteriormente, o type-check global passou a ser bloqueado por arquivos não relacionados em `src/app/(dashboard)/perfil/`.
