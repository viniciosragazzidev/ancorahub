# Valor e vidas no funil de leads

## Objetivo

Entregar a Onda 1 do plano Koter: registrar no lead o valor mensal em reais e a
quantidade de vidas, preenchê-los quando uma cotação vinculada for salva, permitir
edição manual na ficha e exibir a soma por coluna nos Kanbans Lite e Full de `/leads`.
O card também terá o caminho direto para criar uma cotação vinculada; a cotação salva
fica visível no drawer do lead.

## Fontes confirmadas no código

- `quotes.totalMonthly` e `quotes.beneficiaryCount` guardam o resumo da cotação;
  `quotes.leadId` já cria o vínculo com o lead.
- `proposals.totalMonthly` e `proposals.beneficiaryCount` guardam o valor da proposta.
- `sales.saleValue` guarda o valor da venda registrada.
- `leads` ainda não tem campos próprios para valor mensal ou vidas. `qualificationDetails`
  contém `qtdVidas`, mas não é um campo numérico canônico do lead.
- `LightQuoteSimulator` é explicitamente demonstrativo e não será tratado como cotação
  comercial persistida. O fluxo usará `QuoteBuilder` e a tabela `quotes`.

## Plano por componente

1. **Banco e tipo de lead.** Adicionar `leads.monthly_value numeric(12,2) NULL` e
   `leads.lives_count integer NULL` em migration aditiva `0215`, refletir no schema
   Drizzle e entregar o mesmo SQL em `docs/sql/2026-10-30-valor-vidas-funil.sql`.
   Não executar migration nem tocar no banco.
2. **Regra pura de domínio.** Criar funções para normalizar o resumo de uma cotação,
   somar valor e vidas de uma coluna e formatar a linha em `pt-BR`. Testar dinheiro,
   nulos, plural e preenchimento a partir de uma cotação.
3. **Persistência da cotação.** No salvamento da cotação vinculada, persistir seus
   `totalMonthly` e `beneficiaryCount` no lead na mesma transação. Revalidar tenant,
   carteira/unidade e acesso no servidor; auditar a atualização sem registrar dados
   pessoais. Não alterar os registros existentes de proposta ou venda.
4. **Edição manual e cotação no lead.** Disponibilizar valor e vidas editáveis na ficha,
   com validação server-side, auditoria e estado de sucesso/erro. Reaproveitar o
   `QuoteBuilder` e mostrar as cotações do lead em uma seção dedicada do drawer; carregar
   as cotações somente para o lead aberto, ordenadas da mais recente para a mais antiga.
5. **Kanban Lite e Full.** Cada rodapé de coluna mostra a soma dos valores e vidas dos
   leads atualmente carregados nessa coluna, obedecendo o mesmo payload já filtrado e
   escopado que alimenta os cartões. O Lite usa tokens Arc; o Full conserva a estrutura
   visual vigente e compartilha a mesma função de soma.
6. **Cobertura e registros.** Atualizar testes de componentes/dominio, regras de negócio,
   changelog UX, roadmap e este registro; executar Vitest focado com um worker,
   type-check, ESLint, `check:lite-skin` e `agent:docs`. Informar que o SQL deve ser
   aplicado pelo Vinicios antes do deploy.

7. **Controle do Super-admin.** Registrar a feature flag global
   `feature_lead_commercial_values_enabled` no catálogo e no painel do Super-admin,
   habilitada por padrão e reversível com auditoria. Desligada, a interface e as
   mutações de valor/vidas deixam de operar; os dados salvos permanecem.

## Acesso, integridade e segurança

- Identidade, tenant, papel e escopo são derivados da sessão no servidor.
- O valor salvo da cotação é a fonte para atualizar o snapshot mensal do lead; proposta
  e venda continuam em seus registros próprios.
- Valores editados manualmente são opcionais; quando informados, valor deve ser não
  negativo e vidas deve ser inteiro positivo dentro do limite já usado pelo sistema.
- Nenhuma tela confia em `tenantId`, papel ou carteira enviados pelo cliente.
- Sem dados de telefone ou e-mail em logs de auditoria.

## Fora de escopo

- Não integrar preços reais de operadoras nem tratar o simulador demonstrativo como
  proposta comercial.
- Não criar ou alterar registros de proposta/venda ao salvar uma cotação.
- Não executar a migration, rodar testes de banco ou usar `.env.local`.
- Não mudar filtros, paginação, escopo, etapas ou regras de distribuição do funil.

## Decisão de precedência

Vinicios confirmou em 2026-10-30: venda ativa prevalece sobre a proposta ativa mais
recente, que prevalece sobre o snapshot do lead preenchido manualmente ou por cotação.
Sem venda ou proposta ativa, uma cotação vinculada sobrescreve o snapshot manual
anterior. Com fonte formal ativa, edição manual fica bloqueada e salvar uma cotação
não altera o snapshot nem os registros formais. As linhas de proposta e venda ficam
intactas.

## Entrega e validação

- Migration aditiva `0215` pronta para aplicação pelo Vinicios antes do deploy; inclui
  `leads.monthly_value`, `leads.lives_count` e `audit_logs.metadata`. Não foi executada.
  `/leads` e a ficha selecionam as colunas novas mesmo com a flag desligada.
- A feature flag global `feature_lead_commercial_values_enabled` nasce ligada e pode
  ser desligada pelo Super-admin; a alteração é auditada.
- Registros complementares: DEC-165, BR-088 e `docs/ux/UX_CHANGELOG.md`.
- Vitest focado aprovado: 3 arquivos e 19 testes. `npx tsc --noEmit -p .` aprovado.
  ESLint dirigido terminou sem erros, com avisos existentes em arquivos grandes.
- `npm run check:lite-skin` aprovado em modo relatório; Kanban Lite, editor comercial
  e seção de cotações não apresentam desvios. `QuoteBuilder` e `QuoteCard` reaproveitam
  a biblioteca `components/ui` já usada pelo fluxo de cotações. `npm run agent:docs`
  aprovado.
- O harness `agent:verify` não foi executado porque o nível fast roda a suíte inteira,
  incluindo testes fora do escopo autorizado; nenhum build ou teste de banco foi rodado.
- O repositório não contém mais arquivo de dados do roadmap; a rota `/roadmap` só
  redireciona para `/dashboard`.

## Arquivos e componentes

- Domínio, validação e auditoria: `commercial-values.ts` e `commercial-values-actions.ts`;
  `quotes/actions.ts` deriva o lead da sessão/tenant e grava a cotação e o snapshot
  na mesma transação quando não há fonte formal ativa. O metadata de auditoria guarda
  `monthly_value` e `lives_count` anteriores e novos, sem dados pessoais.
- Dados: `leads.monthly_value`, `leads.lives_count`, `audit_logs.metadata`, schema
  Drizzle e SQL 0215.
- Interface: rodapés dos Kanbans Lite/Full, CTA por cartão, drawer e ficha com seção
  de cotações, editor manual e atualização otimista do lead.
- Governança: flag global no catálogo e painel Super-admin, DEC-165, BR-088,
  changelog UX e este registro.

## Riscos e reversão

- Antes do deploy, o Vinicios precisa aplicar o SQL idempotente de
  `docs/sql/2026-10-30-valor-vidas-funil.sql`; `/leads` e a ficha leem os campos de
  valor/vidas mesmo com a flag desligada. O SQL também adiciona `audit_logs.metadata`.
- O Super-admin pode desligar a flag para esconder os novos controles e bloquear as
  ações. Para reverter o código, faça rollback da aplicação; as colunas aditivas
  podem permanecer sem afetar os leads existentes.
- Nenhuma consulta ou teste foi executado contra banco real; não houve alteração de
  dados existentes.
