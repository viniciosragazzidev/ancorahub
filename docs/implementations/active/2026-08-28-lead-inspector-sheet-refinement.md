# Refinamento do sheet de detalhes de lead

## Pattern Blueprint

`DETAIL_PAGE`: Header → Summary → ações rápidas → intervenção → histórico.
Para Diretor e Gestor, o sheet elimina a divisão entre abas de resumo e ação: a
decisão operacional fica em uma leitura única. Os outros papéis preservam o fluxo
existente em abas.

## Escopo

- Reorganizar o inspector lateral em `/leads` para que Diretor/Gestor priorizem
  situação, responsável, marcos do atendimento e intervenção.
- Usar `Sheet`, `Button`, `Tabs`, badges e tokens já existentes.
- Preservar mascaramento de PII, RBAC, links existentes e as ações de gestão.

## Mudança visual

- Cabeçalho com linguagem de operação e não de cadastro.
- Resumo em grade: responsável, unidade, atribuição, primeiro contato, início do
  atendimento e etapa atual.
- Ações rápidas autorizadas para abrir a conversa ou o cadastro completo.
- Intervenções existentes reunidas em uma única seção, sem duplicar qualificação,
  reatribuição ou investigação.
- Histórico de atribuições permanece abaixo da decisão atual.

### Refinamento visual de 31/08

- A identidade do lead ganhou espaçamento consistente e os badges passam a quebrar
  linha sem disputar espaço com o nome e telefone.
- O resumo operacional usa uma única grade responsiva: cada marco mantém rótulo e
  valor alinhados, em duas colunas largas ou uma coluna em telas estreitas.
- Ações rápidas e intervenções agora usam o mesmo cabeçalho de seção e conteúdo
  interno, evitando controles soltos e bordas duplicadas.

## Estados e acessibilidade

- O botão de fechar, abas e ações preservam teclado e foco fornecidos pelos
  primitives existentes.
- Em tela estreita, o sheet continua em formato de painel inferior e a grade
  retorna a uma coluna.
- Quando há mascaramento para Marketing, não são exibidas ações diretas de
  conversa ou ligação e os dados continuam ofuscados.

## Rollback

Reverter somente `src/app/(dashboard)/leads/leads-workspace.tsx`; não há
migração, alteração de dados ou contrato de API.
