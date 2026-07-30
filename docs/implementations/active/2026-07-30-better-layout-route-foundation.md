# Fundação de layout para rotas autenticadas

## Objetivo

Garantir que as rotas autenticadas do AncoraHub compartilhem uma estrutura
resiliente em desktop e mobile: um único landmark principal por página, eixo
inline sem vazamento, tabelas que não extrapolam a área de trabalho, ações de
header alcançáveis e espaço seguro antes da navegação móvel.

## Escopo e arquivos

- `src/components/ui/sidebar.tsx`: `SidebarInset` deixa de renderizar um
  elemento `main`. As páginas continuam sendo as donas do landmark principal,
  evitando `main` aninhado no shell compartilhado.
- `src/components/app-shell.tsx` e `src/components/platform-admin-shell.tsx`:
  contentores fluidos, overflow horizontal contido, rolagem estável e largura
  de sidebar alinhada em 225px.
- `src/components/dashboard-header.tsx`: área contextual de ações passa a
  permanecer acessível em faixa rolável quando a largura se esgota.
- `src/components/mobile-bottom-nav.tsx`: espaçamento seguro coerente com o
  fim da área de rolagem e tipografia de navegação baseada na escala do sistema.
- `src/app/globals.css`: guardrails compartilhados de `min-inline-size` e
  `max-inline-size` para as 70 páginas autenticadas encontradas na auditoria
  estática; 61 delas possuem landmark `main` próprio (42 no dashboard e 19 no
  Super Admin).
- `src/components/route-loading.tsx`: loading sem hero artificial, no mesmo
  limite de leitura de 1280px das superfícies operacionais.

## Decisões

- Não há mudança de regra de negócio, dados, permissões ou feature flag. A
  alteração é estrutural e reversível por código.
- Páginas preservam seus layouts de domínio; o shell somente impõe limites que
  impedem corte e overflow acidental. As grades que exigem rolagem horizontal
  continuam usando o `Table` compartilhado.
- A ação que ultrapassa o header não é escondida: fica em uma faixa horizontal
  com rolagem, preservando a descoberta e o acesso por teclado.

## Validações

- `npm run type-check`: aprovado.
- `git diff --check`: aprovado.
- A verificação final de build e do harness será registrada ao final do ciclo.

## Riscos e rollback

Não há migration. O principal risco é uma composição legada que dependia de
largura intrínseca; `min-inline-size: 0` permite a contração sem cortar a
semântica e as tabelas mantêm scroll horizontal próprio. O rollback é reverter
os sete arquivos de fundação deste registro.
