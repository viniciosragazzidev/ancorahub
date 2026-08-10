# Redesign operacional integral - AncoraHub

## Objetivo

Substituir a apresentação herdada por um CRM operacional mais calmo, claro e
consistente, sem alterar dados, regras comerciais, permissões ou isolamento de
tenant. A nova interface continua reversível pela capacidade auditável já
existente, `feature_clean_ui_operational_enabled`.

## Direção aprovada

- A sidebar mantém a cor-base atual.
- A identidade oceânica aparece apenas em profundidade e detalhes de contexto.
- A prioridade, o prazo e a próxima ação aparecem antes de dados técnicos.
- Controles recorrentes usam os primitives compartilhados; não haverá campos
  nativos ou variações locais concorrentes.
- Motion de rotina usa transições curtas, interruptíveis e compatíveis com
  `prefers-reduced-motion`. GSAP fica reservado para momentos futuros de marca
  ou onboarding, quando houver uma interação que o justifique.

## Entregue nesta onda

- Criados `PRODUCT.md` e a revisão 4.0 de `DESIGN.md` como contratos de produto
  e design.
- Consolidada a linguagem de superfície, raio, borda, elevação, foco e motion
  em `globals.css` e nos primitives de card, botão, input, textarea, checkbox,
  select, tabs, dialog, skeleton e tabela.
- Reestruturado o cockpit do Corretor para destacar a próxima ação, o dia, a
  agenda, a fila e a Inbox antes dos detalhes secundários.
- Reforçada a jornada de Leads: superfície de workspace, filtros progressivos,
  chips ativos e controles acessíveis compartilhados.
- Migrados todos os selects nativos detectados em Leads, Propostas, Assistente,
  Metas, Integração Meta e Pós-venda para `AppSelect`.

## Próximas ondas

1. Revisar estruturalmente Lead 360, Conversas, Tarefas e Minha Fila.
2. Aplicar o mesmo padrão aos workspaces de gestão, relatórios e direção.
3. Reorganizar automação, IA, integrações, configurações, Super-admin e páginas
   públicas por fluxo de configurar, validar, ativar e acompanhar.
4. Fazer evidência visual desktop/mobile e concluir o registro após a revisão
   das rotas restantes.

## Evidências desta rodada

- `npm run ui:audit`: aprovado, sem selects nativos fora do padrão.
- `npm test`: 62 arquivos e 266 testes aprovados.
- Type-check isolado do código fonte: aprovado. O comando padrão de type-check
  permanece bloqueado pelos tipos temporários de um servidor Next local já em
  execução; o processo não foi interrompido.

## Rollback

Desligar `feature_clean_ui_operational_enabled` devolve o layout operacional
anterior onde a capacidade já é aplicada. Os primitives compartilhados não
alteram dados nem o contrato de qualquer Server Action.
