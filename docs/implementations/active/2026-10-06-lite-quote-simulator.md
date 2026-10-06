# Simulador demonstrativo de cotação do Corretor Lite

**Status:** partial  
**Data:** 2026-10-06

## Escopo

Nova experiência local em /cotacao para corretores, com seis etapas, cadastro
demonstrativo de vidas, filtros, comparação de até três planos e resumo compartilhável.
Os preços, redes, hospitais, produtos e exemplos de lead são fictícios. Não consulta
o catálogo oficial (DEC-031), não cria uma Cotação persistida e não vincula ou altera
leads. Não houve alteração em banco, migration ou API.

## Decisões e limites

- A faixa etária usa as dez faixas e os limites de preço descritos na RN ANS 563/2022.
- Os multiplicadores são estáticos e demonstrativos; não representam tabela de operadora.
- A rota exige sessão de tenant e papel de corretor. O modo Lite recebe o item de
  navegação em /cotacao; o sidebar clássico também aponta para a rota.
- A cópia, abertura do WhatsApp e impressão ocorrem somente após ação explícita.
- A prévia de lead não persiste. Nenhum dado digitado é salvo em localStorage.
- A entrega fica partial: falta integrar preços/catálogo versionados, auditoria,
  configuração e kill switch de Super-admin antes de tratar isto como capacidade
  operacional ou proposta comercial.
- Sem novos tokens, primitives, variantes ou animações.

## Arquivos e fluxos

- src/app/(dashboard)/cotacao/page.tsx
- src/features/broker-workspace/components/light-quote-simulator.tsx
- src/features/broker-workspace/quote-simulator/mock-data.ts
- src/features/broker-workspace/quote-simulator/pricing.ts
- src/features/broker-workspace/quote-simulator/pricing.test.ts
- src/app/(dashboard)/layout.tsx, src/components/app-shell.tsx,
  src/components/light-top-nav.tsx, src/components/corretor-sidebar.tsx
- CONTEXT.md, docs/ux/UX_REDESIGN_CONTROL.md,
  src/features/roadmap/roadmap-data.ts

## Validação

Pendente de execução após aplicar os arquivos ao repo.

## Rollback

Remover a rota, o componente e a pasta quote-simulator, retirar /cotacao das
duas navegações e do allowlist Lite, e reverter os registros no CONTEXT, controle UX
e roadmap. Não há dados para migrar ou apagar.
