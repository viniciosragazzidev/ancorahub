# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Corretores iniciam o dia atendendo a própria carteira e precisam identificar, atender e registrar a próxima ação sem perder contexto. Gestores acompanham exceções, distribuição e capacidade da unidade. Diretores configuram a operação e decidem onde intervir. Super-admins mantêm tenants, segurança, saúde e auditoria da plataforma.

## Product Purpose

AncoraHub organiza a operação comercial de corretoras de saúde: captação, distribuição, atendimento, cotação, documentação, venda, pós-venda e canais de comunicação. O sucesso é reduzir o tempo entre uma pendência real e sua resolução com rastreabilidade.

## Positioning

O sistema combina contexto comercial, SLA, distribuição por unidade e permissões multi-tenant numa única operação; a interface nunca é autoridade de tenant, papel, carteira ou dados pessoais.

## Operating Context

Uso recorrente em desktop durante o atendimento e em celular no plantão. A maior parte do trabalho começa por uma fila, conversa, tarefa ou exceção, e termina ao registrar uma ação, atualizar uma tarefa ou encaminhar um atendimento.

## Capabilities and Constraints

- Next.js App Router, TypeScript, Drizzle/Postgres e Better Auth.
- Isolamento de tenant, unidade, carteira e papel vem do servidor.
- Dados pessoais, documentos e canais exigem permissões e auditoria.
- A experiência deve funcionar em light/dark mode, teclado, zoom e tela estreita.
- A nova interface é padrão, mas reversível pelo Super-admin sem perda de dados.

## Brand Commitments

Ancora Corretora usa uma identidade oceânica discreta, profissional e confiável. A cor-base da sidebar atual deve permanecer. A marca apoia a leitura operacional; não substitui status, prioridade ou conteúdo.

## Evidence on Hand

- Funcionalidades e regras: `docs/business-rules.md`, `docs/decision-log.md` e `docs/information-architecture/`.
- Sistema visual atual: `DESIGN.md`, `src/app/globals.css` e `src/components/ui/`.
- Fluxos principais: dashboard, leads, conversas, tarefas, gestão, integrações e Super-admin.

## Product Principles

1. Mostrar a próxima decisão antes de mostrar todos os dados.
2. Uma ação frequente fica visível; ações raras aparecem no contexto certo.
3. Clareza e confiança são mais importantes que ornamentação.
4. O mesmo estado mantém nome, cor, comportamento e consequência em todo o produto.
5. Dados e permissões são preservados; o redesign altera somente a forma de operar.

## Accessibility & Inclusion

Contraste AA, foco visível, navegação por teclado, zoom de 200%, reduced motion, responsividade e texto claro são requisitos de produto.
