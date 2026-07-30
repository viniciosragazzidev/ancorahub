# Fundação de acessibilidade compartilhada

## Objetivo

Elevar o piso de acessibilidade de todas as rotas por meio dos componentes e
shells compartilhados, sem alterar regras de negócio, permissões ou dados.

## Entrega

- Link de atalho para o conteúdo principal como primeiro controle da aplicação,
  disponível em rotas públicas e autenticadas.
- Indicador de foco visível, inclusive em forced-colors, para controles nativos
  e widgets semânticos.
- Destino de foco único no frame de rota, com foco programático seguro.
- Tabs, trilho de áreas e navegação móvel receberam anel de foco com offset.
- Erros de formulário usam `role="alert"`, então não dependem apenas de cor.
- Busca global ganhou papel de diálogo modal, título, rótulo de campo, status
  anunciado, foco inicial, retorno ao gatilho e ciclo de Tab interno.
- A fundação existente de Base UI continua responsável por diálogos, sheets,
  menus, selects e checkboxes.

## Limites conhecidos

Esta fatia torna a infraestrutura comum acessível e corrige interações
transversais. Formulários e widgets de domínio ainda precisam de revisão por
fluxo para associar cada erro e descrição específica ao respectivo campo.

## Validação

- Testes jsdom cobrem o link de atalho e o anúncio de erro de formulário.
- Type-check aprovado.
- Lint aprovado sem novos erros; o repositório mantém avisos legados fora deste
  escopo.
- `npm run agent:verify -- --level full` excedeu o limite local de 120 segundos
  durante a etapa de build, sem emitir erro de compilação. A validação completa
  de build permanece pendente antes de publicar.
