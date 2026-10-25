# Diretor Lite, F2 chrome

Status: implementado na branch `feat/diretor-lite-f2`; aprovação visual dos prints ainda pendente.

## Contrato

- Papel: diretor autenticado com `feature_director_lite_style` ativa no tenant.
- Objetivo: aplicar a linguagem visual Lite à moldura normal do diretor sem alterar rotas, dados ou permissões.
- A chave desligada conserva os ramos de renderização existentes. As regras novas de chrome ficam sob `.arc-venancor[data-skin="diretor"]`.
- Reversão: desligar `feature_director_lite_style` restaura o shell normal; reverter os commits remove a implementação.

## Implementação

- O `AppShell` envolve o chrome com o escopo Arc, aplica o canvas e removeu o ramo financeiro sem rota correspondente.
- A sidebar mantém seções, destinos e permissões, com item ativo em pílula, ícones monocromáticos, Avatar e Badge Arc, atalhos e menu móvel de 44px.
- `DashboardHeader` conserva sua API pública, usa `LightAppHeader` no ramo do diretor e mantém as ações existentes. O botão Mais aparece abaixo de 1024px.
- `director-routes` fornece títulos e pais para os detalhes. `RouteSectionTabs` recebe chips por seletores CSS escopados, sem mudar seu HTML para outros papéis.
- A paleta Ctrl+K reúne pesquisa global e destinos; notificações, atalhos, feedback, Agente IA, troca de papel e instalação PWA recebem o chrome Arc.
- Loading, erro e não encontrado usam estados Arc sob a chave. O wizard inicial e o onboarding de rota recebem a pele do diretor.
- A prévia `/dev/diretor-f2-preview` usa o `AppShell` e o `DashboardHeader` reais, com fixtures locais, e retorna 404 fora de desenvolvimento.

## Arquivos e validação

- O detalhe de implementação está no diff desta branch, concentrado em `src/components/app-shell.tsx`, `src/components/corretop-sidebar.tsx`, `src/components/dashboard-header.tsx`, `src/components/arc/director-chrome.css` e nos componentes globais condicionados ao escopo.
- Vitest focado: 11 arquivos, 22 testes aprovados. Cobertura inclui rotas, preview dev, menu Mais, abas por seção, header com chave ligada e desligada, pesquisa, Ctrl+K/Ctrl+J/Ctrl+B, agente, PWA e a altura/consulta preservadas na paleta sem a chave.
- `npx tsc --noEmit -p .`: passou.
- ESLint dos arquivos TypeScript alterados: 0 erros; 19 avisos existentes nas áreas de agente, busca, sidebar, atalhos, notificações, PWA e onboarding.
- `node scripts/check-lite-skin.mjs`: passou em modo relatório. O relatório inclui desvios preexistentes fora do escopo da F2.
- Diagnósticos `agent:docs`, `agent:changed`, `agent:architecture` e `agent:security`: aprovados. `agent:performance` registra 2 alertas para componentes cliente já grandes (`corretop-sidebar.tsx` e `ui/sidebar.tsx`), mantidos porque esta etapa implementa a moldura e o atalho da sidebar.
- Sem build, teste de banco, migration, uso de `.env.local` ou push.

## Inspeção visual

- Oito prints do shell real em 1440, 1024, 768 e 390px, com chave ligada e desligada, estão em `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/f2-prints/`.
- Prints adicionais mostram a navegação e o menu Mais abertos em 390px. O Mais abre expandido e mantém Sair visível; os controles e linhas de navegação têm pelo menos 44px.
- Todas as oito capturas retornaram 200, mantiveram os 13 itens de menu e não tiveram rolagem horizontal. Os prints aguardam aprovação do Vinicios antes de qualquer merge.

## Itens fora desta etapa

- O shell compartilhado já tem tratamento próprio no `/dashboard`; esta etapa não mexeu em telas de `/leads` ou `/conversas`, conforme a coordenação.
- A retirada de rotas do opt-out depende de revisão cruzada e aprovação visual, conforme o plano.
