# Refinamento de espaçamento e acabamento do diretor Lite

Pedido do Vinicios (25/10): "percebi falhas no refinamento de espaçamento etc; melhore nisso, usando todas as skills de UX UI disponíveis". Base: regras do Arc (composition, design, responsive, checklist) aplicadas aos tokens Lite. Vale para toda tela do diretor com a chave ligada. Chave desligada: nada muda.

## 1. Contrato

### Container e margens
- Um único container de página, definido pela moldura (app-shell), igual em todas as rotas do diretor: `max-width` 1328px, `margin-inline: auto`, `padding: 24px clamp(16px, 4vw, 32px) 96px`.
- Nenhuma tela ou bloco adiciona margem lateral própria. Nada de segundo container dentro da página. O que hoje tem `padding` próprio de página (por exemplo `.page` do painel Lite) passa a herdar o da moldura.
- O título da página mora no topo da moldura (DashboardHeader da F2). A tela não repete o título no corpo. A saudação do painel fica como subtítulo de uma linha, sem duplicar "Painel".
- A borda esquerda do título, do primeiro card e da tabela ficam alinhadas na mesma linha vertical.

### Ritmo vertical (grade de 4px)
- 8px entre rótulo e valor; 12px entre itens de uma lista compacta; 16px dentro de um grupo (campos, cards irmãos); 24px entre regiões da página; 32px antes de uma seção nova numa página longa.
- Topo da moldura até o primeiro conteúdo: 24px. Último conteúdo até o fim da página: 96px (respiro para a barra de lote e o botão flutuante).
- Cabeçalho de seção: título 18px/500, descrição 14px `--text-secondary` com 4px entre os dois, 16px até o conteúdo.

### Cards e superfícies
- Card: borda de 1px `--border`, raio `--radius-surface`, padding 24px (16px no celular). Sem sombra, salvo camada flutuante. Sem card dentro de card: grupos internos usam divisória `--border-subtle` ou fundo `--surface-muted` com raio concêntrico (`calc(var(--radius-surface) - padding)`).
- Cards irmãos: mesmo topo, mesma altura (`align-items: stretch`), espaço de 16px entre eles, bordas externas rente à coluna.
- Botão de ajuda "?" no canto do card: 44px de área, alinhado ao topo do título (não ao card), 0 de margem extra.

### Tipografia
- Escala só por tokens. Números que mudam ou alinham em coluna: `font-variant-numeric: tabular-nums`.
- Pesos: 400 e 500 no corpo e títulos; 600 só em número de destaque (decisão D do plano, teto 700). Sentence case, sem caixa alta, sem rótulo acima de título.
- Linhas de texto auxiliar com no máximo ~80 caracteres (`max-width: 72ch`); notas longas embaixo de tabela viram o ícone de ajuda.

### Controles e barras
- Altura 44px em tudo que é tocável no diretor. Espaço entre controles de uma barra: 8px; entre grupos de controles: 16px.
- Barra de filtros: busca e "Filtros" numa linha; chips de etapa numa linha que rola dentro do próprio container no celular (sem quebrar a página), com 8px entre chips.
- Barra de lote: flutuante, centralizada, `max-width` igual ao container, 16px acima do rodapé, sombra `--shadow-floating` (é camada flutuante), não cobre a última linha (o respiro de 96px garante).

### Tabelas, listas e kanban
- Tabela larga rola dentro do card, nunca a página. Linha de 52px, 16px de padding lateral nas células, cabeçalho 12px `--text-secondary`.
- Kanban: colunas de 280 a 320px, 16px entre colunas, a faixa de colunas rola dentro do container com dica de que tem mais (sombra de borda ou fade no fim, só como indicação), e nunca corta um card no meio na borda direita da página.
- Cartão do kanban: 16px de padding, 8px entre linhas, no máximo 2 linhas de etiquetas (o resto em "+N").

### Celular (390)
- Margem 16px. Nada de rolagem lateral da página. Rótulos curtos para não quebrar linha dentro de controle. Grupos de controles empilham com 8px.

### Moldura
- Menu lateral: 12px de padding, itens de 44px, 2px entre itens, 16px antes de cada título de seção, título de seção 12px `--text-muted`.
- Topo do menu (super admin): "Visão" e "Ver como" empilhados, largura total, 8px entre eles, mesma linguagem visual dos itens do menu.
- Topo da página: altura 64px, conteúdo alinhado ao container da página, borda inferior `--border-subtle`.

## 2. Defeitos vistos nos prints e no print de produção (25/10)
1. Painel colado no topo e no menu, sem a barra de topo (produção).
2. Super admin: "Visão" e "Ver como" lado a lado, cortados (produção).
3. Painel: a linha "O período muda só..." solta entre abas e cards; vira texto de ajuda do seletor de período.
4. Painel: nota longa embaixo de "Leads por fila" ocupa a largura toda; vai para o "?".
5. Painel: cards de plantão ocupando só parte da linha com vão grande à direita; usar `repeat(auto-fill, minmax(280px, 1fr))`.
6. /leads: título "Leads" repetido no corpo; busca, filtros e alternar lista/kanban espalhados em 3 linhas; juntar em uma barra.
7. /leads kanban: coluna cortada na borda direita; aplicar a regra de rolagem interna.
8. /leads kanban: caixa de seleção ocupa uma linha inteira no topo do cartão; mover para o canto do cabeçalho do cartão junto do ícone de conversa.
9. /leads: muitas etiquetas por cartão; limitar a 2 linhas.

## 3. Como validar
- Prints só na rota `/dev/diretor-shell-real` (AppShell real), casos diretor comum e super admin vendo como diretor, em 390, 768, 1024 e 1440.
- Rodar o checklist do Arc (`~/.claude/skills/arc/checklist.md`) nos arquivos tocados e responder linha a linha o que falhou e foi corrigido.
- Medir no navegador (Playwright `getBoundingClientRect`): borda esquerda de título, primeiro card e tabela iguais; espaços entre regiões = 24px; nenhum elemento com `scrollWidth > clientWidth` na página.
