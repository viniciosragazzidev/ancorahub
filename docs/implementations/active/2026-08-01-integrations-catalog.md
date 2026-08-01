# Catálogo de integrações

## Objetivo

Transformar a navegação de Integrações em um catálogo extensível, sem trocar ou duplicar a configuração existente da Meta.

## Escopo entregue

- Nova rota protegida: `/settings/integrations`.
- Catálogo com Meta Business, Facebook Lead Ads, WhatsApp oficial e fontes de site como entradas disponíveis.
- Instagram e Outros conectores expostos somente como próximos itens, sem link ou configuração simulada.
- Sidebar renomeada de “Integração Meta” para “Integrações”.
- A área `/settings/meta` continua sendo a fonte de configuração para os conectores Meta já implementados.

## Segurança e reversão

A rota exige a capacidade `acessar_integracao_meta`. O catálogo não cria, altera nem revela credenciais; controles de tenant, auditoria e feature flags continuam no conector específico. Reverter consiste em restaurar o item da sidebar para `/settings/meta` e remover a rota do catálogo.

## Validações executadas

- `npm run type-check`.
- Teste unitário do catálogo: disponível versus conector em preparação.
- Lint dirigido dos arquivos alterados.
- `npm run agent:docs` e `npm run agent:verify -- --level fast`.
- `npm run build`, incluindo a rota dinâmica `/settings/integrations`.
