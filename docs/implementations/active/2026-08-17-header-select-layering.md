# Camada dos selects do cabeçalho

## Problema

Os selects usados nas ações do `DashboardHeader` eram renderizados dentro do
próprio cabeçalho. O `sticky`, o `backdrop-blur` e os containers de rota criam
contextos de empilhamento independentes; portanto, `z-index: 50` não garantia
que a lista ficasse acima da superfície da aplicação.

## Correção

`SelectContent`, o primitivo compartilhado, agora renderiza a lista em um portal
no `document.body`, com posição `fixed` ancorada no trigger. A posição é
recalculada em scroll, redimensionamento e alteração do conteúdo. O fechamento
por Escape, clique externo e clique em opções continua preservado, inclusive
quando a lista está fora da árvore DOM do trigger.

## Validação

- O teste `src/components/motion/select.test.tsx` comprova que a lista aberta
  sai do container com `overflow` do cabeçalho e passa para a camada do documento.
- Os testes de push, type-check, lint dirigido e build de produção complementam
  a validação desta entrega.
