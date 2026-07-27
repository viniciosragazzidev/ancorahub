# Padrões de acessibilidade e compatibilidade de interação

## Meta

As superfícies operacionais devem ser utilizáveis com teclado, leitor de tela, zoom e viewport estreito, sem depender de cor, hover, áudio ou precisão de toque. Usar WCAG 2.2 AA como referência de aceite; declarar qualquer exceção.

## Semântica e estrutura

- Uma página tem um `h1` claro; headings seguem ordem sem saltos artificiais.
- Usar `main`, `nav`, `header`, `section`, `aside` e `footer` conforme o significado.
- Links navegam; botões executam ações; não simular um com o outro.
- Tabelas usam caption/headers e não são usadas para layout.
- Listas, status, progresso e contadores usam estrutura semântica e texto equivalente.
- Ícones decorativos têm `aria-hidden`; ícones acionáveis têm nome acessível.

## Teclado e foco

- Toda ação alcançável sem mouse e em ordem previsível.
- Foco visível e nunca removido por `outline: none` sem substituto.
- Dialog/Sheet: foco entra no título ou primeiro controle relevante, fica contido e retorna ao disparador ao fechar.
- Menus, tabs, comboboxes e tabelas seguem o padrão de teclado do componente compartilhado.
- Não usar hover como único caminho para tooltip, ação ou informação.

## Formulários

- Label persistente, instrução antes do campo e erro associado por `aria-describedby`.
- Não usar placeholder como label.
- Erros explicam como corrigir e não apagam o valor digitado.
- Campos obrigatórios e formato esperado são anunciados.
- Submissão mostra progresso, sucesso ou erro; botão não fica sem consequência.
- Confirmação extra apenas para ações destrutivas ou irreversíveis.

## Cor, contraste e movimento

- Texto normal com contraste mínimo 4.5:1; texto grande 3:1; controles e foco 3:1.
- Cor nunca é o único indicador; combinar texto, ícone, posição ou padrão.
- Estados semânticos usam tokens do design system, incluindo light/dark.
- Toda animação tem propósito, duração curta e fallback estático.
- Respeitar `prefers-reduced-motion`; sem parallax, autoplay ou transição indispensável.
- Respeitar `prefers-contrast`/zoom quando suportado; não fixar altura que corte conteúdo.

## Responsividade

- Testar 320 px, 375 px, 768 px, 1024 px e desktop amplo.
- Conteúdo não depende de rolagem horizontal, exceto tabelas com alternativa acessível.
- Alvos de toque com área confortável e espaçamento suficiente.
- Dialogs e sheets cabem em viewport móvel e têm rolagem interna sem prender o documento.
- Tabs densas permitem rolagem acessível e deixam claro qual está ativa.

## Conteúdo e estados

Toda rota relevante precisa de loading, vazio, erro, sucesso, desabilitado, permissão negada e indisponível quando aplicável. Cada estado responde: o que ocorreu, o que o usuário pode fazer e o que acontece depois.

## Verificação manual mínima

1. Navegar pela rota apenas com teclado.
2. Usar VoiceOver/NVDA em heading, landmark, formulário, tabela, dialog e toast.
3. Aplicar zoom de 200% e viewport estreito.
4. Ativar dark mode e `prefers-reduced-motion`.
5. Confirmar foco após navegação, abertura/fechamento e erro de validação.
