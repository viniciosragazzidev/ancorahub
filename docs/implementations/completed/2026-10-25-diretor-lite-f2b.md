# Correcoes da revisao F2b do Diretor Lite

Status: concluidas na branch `feat/diretor-lite-f2b`, baseada em `origin/feat/diretor-visual-lite` (`4af57b0c`).

## Ajustes

- Regras de `director-chrome.css` alcancam os casos em que o elemento com `arc-venancor[data-skin="diretor"]` tambem e a raiz do header, estados de rota, paleta, drawers e prompt PWA.
- O dialogo de atalhos combina as classes do escopo Arc com suas classes de layout.
- `AppShell` memoiza `shellUser`; a sidebar sincroniza o perfil somente quando o escopo Diretor esta ativo.
- Navegacao, paleta e `/api/search` compartilham regras de visibilidade. O servidor filtra funcionalidades por papel e permissao.
- A paleta indica carregamento desde a entrada da busca, durante o debounce.

## Validacao

- Vitest focado: 7 arquivos, 17 testes aprovados.
- `npx tsc --noEmit -p .`: aprovado.
- ESLint dos arquivos tocados: 0 erros; 12 avisos existentes de conteudo, imagem e acesso a ref.
- `agent:docs`, `agent:changed`, `agent:architecture` e `agent:security`: aprovados; arquitetura e seguranca sem achados. `agent:performance` manteve 1 alerta conhecido para o componente cliente extenso `corretop-sidebar.tsx`.
- `node scripts/check-lite-skin.mjs`: executado em modo relatorio; desvios listados pertencem ao baseline fora dos arquivos convertidos.
- Validacao focada, sem build nem suite completa.