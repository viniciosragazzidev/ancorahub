# UX-M1 — Mobile Experience transversal

**Data:** 05/09/2026  
**Estado:** código concluído; QA visual/interacional autenticado pendente

## Objetivo

Recompor o CRM autenticado para mobile mantendo as mesmas rotas, fontes de dados,
permissões e regras multi-tenant do desktop. Mobile muda prioridade e interação,
não o domínio.

## Entregas

1. **Foundation e shell:** viewport seguro, tokens globais de geometria, safe areas,
   touch target, header compacto, bottom navigation por papel e Sheet full-height.
2. **Dashboard:** KPIs compactos, ordem decisória e `ResponsiveDataView` para listas
   semânticas de comercial, equipe, unidades e financeiro.
3. **Operação:** leads preservam lista/kanban; detalhe usa tabs roláveis; conversas
   alternam explicitamente entre lista e chat, com contexto em Sheet.
4. **CRM administrativo:** clientes, equipe, vendas e cronograma têm representação
   mobile sem depender de tabela horizontal.
5. **Configuração:** qualificação, settings e WhatsApp usam navegação touch rolável;
   catálogo e Meta empilham sem duplicar fluxos.

## Fronteiras preservadas

- nenhuma dependência adicionada;
- nenhuma rota ou API exclusiva de mobile;
- nenhuma alteração em autorização, tenant, carteira, distribuição ou persistência;
- `/tarefas` e `/metas` não foram inventadas;
- Super Admin, dev, autenticação e páginas públicas permanecem fora;
- visual clássico do Corretor Lite preservado pela DEC-015.

## Evidência técnica

- TypeScript (`tsc --noEmit`): aprovado;
- lint dirigido das superfícies alteradas: sem erros; somente avisos preexistentes;
- testes de foundations, primitives, catálogo de integrações e conversas oficiais:
  4 arquivos, 16 testes aprovados;
- harness rápido: documentação, TypeScript e suíte integral aprovados (144 arquivos,
  652 testes), com evidência em
  `reports/agent/verification/2026-09-05T23-19-00.416Z.md`;
- auditoria estrita de componentes: aprovada, sem novas divergências;
- build Next.js 16.2.10/Turbopack: compilação, TypeScript e geração de 79 páginas
  concluídos com sucesso. Os avisos de uso dinâmico de `headers` são rotas
  autenticadas corretamente classificadas como renderização sob demanda.

## Gate M1.10 pendente

Testar com sessão autenticada nas larguras 320, 360, 375, 390, 412 e 430px,
incluindo landscape/altura curta, teclado aberto, back, scroll restoration, rede
lenta, double submit, reduced motion e comparação Desktop × Mobile. Atualizar
`MOBILE_FUNCTIONALITY_MATRIX.md` de `CODE_READY` para `PRESERVED` somente após
evidência por rota.

## Rollback

Os lotes são exclusivamente de composição. Podem ser revertidos por commit sem
migração de dados. A foundation deve ser revertida por último, após os consumidores.
