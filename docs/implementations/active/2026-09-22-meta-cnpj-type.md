# Captura do Tipo de CNPJ em leads Meta

## Objetivo

Preservar a resposta personalizada `Tipo de CNPJ` enviada pela Meta Lead Ads e
deixá-la visível nas informações do lead sem alterar a classificação PF/PME.

## Implementação

- `normalizeMetaLead` lê apenas o campo allowlisted `tipo_de_cnpj` (com aliases
  equivalentes), limita o valor a 120 caracteres e continua descartando respostas
  personalizadas não solicitadas.
- O intake grava a resposta em `leads.source_metadata.tipoCnpj`, coluna já existente;
  não há migration.
- Quando o telefone corresponde a um lead do mesmo tenant, o serviço mescla os
  metadados da origem sem apagar valores previamente salvos.
- A página de detalhe exibe `Tipo de CNPJ` na seção de origem Meta apenas quando o
  canal é `meta_lead_ads` e há uma resposta não vazia.
- A entrada continua dentro do webhook Meta assinado e do fluxo atual de auditoria;
  nenhum payload pessoal adicional é escrito em logs.

## Validação

- Testes focados `meta-lead-ads.test.ts` e `webhook-intake-sync.test.ts`: 22 passaram.
- Type-check e lint dos arquivos alterados: passaram (lint com avisos preexistentes,
  sem erros).
- `agent:docs`: 17 referências verificadas.
- `agent:verify --level full`: documentação, lint, type-check e diagnósticos
  executados; a suíte global teve 877/878 testes aprovados e foi interrompida por
  falha preexistente em `broker-lite-experience.test.tsx:30` (contrato de rota do
  Dashboard Lite, fora do escopo). Segurança: 0 achados; arquitetura e desempenho
  registraram apenas os tamanhos já existentes das páginas grandes.
- Build final de produção: aprovado (`npm run build`, Next.js 16.2.10), incluindo
  compilação, TypeScript e geração de páginas. Os avisos de `headers` durante
  prerender são os sinais esperados de rotas dinâmicas.

## Riscos e reversão

- Campo ausente continua sem efeito; leads existentes mantêm metadados prévios.
- Reverter o código remove a captura e a apresentação, mas os valores já persistidos
  podem permanecer em `source_metadata` sem afetar o funcionamento do lead.
