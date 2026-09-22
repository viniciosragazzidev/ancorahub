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

- Pendente: teste focado de normalização, persistência e mesclagem de metadados.
- Pendente: type-check, lint dos arquivos alterados, harness `agent:verify --level
  full` e build de produção.

## Riscos e reversão

- Campo ausente continua sem efeito; leads existentes mantêm metadados prévios.
- Reverter o código remove a captura e a apresentação, mas os valores já persistidos
  podem permanecer em `source_metadata` sem afetar o funcionamento do lead.
