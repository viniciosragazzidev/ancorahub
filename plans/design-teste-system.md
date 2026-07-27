# Plano de refatoração — DesignTeste no CorreTop

## Problema

O CRM tinha tokens neutros e variações locais de raio, cor e tipografia. Isso
reduzia a consistência entre shell, formulários, tabelas e estados de feedback.

## Solução

Mapear o DesignTeste (Vendria Light) para os tokens semânticos existentes e
evoluir os primitivos compartilhados antes de ajustar superfícies de produto.
O resultado preserva rotas, regras de negócio e dark mode, mas aplica uma
hierarquia roxo/lima, bordas lavanda, escala de espaçamento 4px e controles
com raios consistentes.

## Commits planejados

1. Registrar tokens Vendria Light sem alterar contratos de dados.
2. Atualizar Button, Card, Input e Badge usando os tokens compartilhados.
3. Validar shell e superfícies operacionais com type-check, testes e build.
4. Publicar uma branch de preview independente da produção.

## Decisões

- O roxo é reservado para a ação principal, links e foco; o lima é um acento,
  nunca texto de corpo.
- A tipografia de corpo continua Geist/stack existente; Bricolage Grotesque é
  usado como fallback de títulos sem adicionar dependências.
- A densidade do CRM permanece operacional; padrões AIDA e mockups mobile não
  serão impostos em rotas de trabalho.
- Motion existente permanece governado por tokens e `prefers-reduced-motion`.

## Testes

- TypeScript estrito (`npm run type-check`).
- Lint dos componentes alterados e build de produção.
- Revisão manual de contraste, foco, viewport estreito, dark mode e reduced motion.

## Fora de escopo

- Alterações de schema, integrações, regras de negócio ou URLs.
- Imagens decorativas e mockups dentro do CRM.
- Alias de produção da Vercel; esta entrega é somente preview.
