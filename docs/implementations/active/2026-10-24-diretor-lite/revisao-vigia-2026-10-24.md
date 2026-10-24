# Revisão adversarial do plano do diretor Lite (Vigia, 2026-10-24)

Alvos: `docs/implementations/active/2026-10-24-diretor-lite-redesign.md` (abreviado "plano"), `docs/implementations/active/2026-10-24-diretor-lite/motion-e-acabamento.md` (abreviado "motion") e os anexos `plano-telas.md`, `inv-qualidade.md`. Repo lido: `ancorahub-lite-listas`, HEAD 5026f66e. Nada foi editado no código.

Resumo: 3 bloqueantes, 20 importantes, 6 menores.

## Bloqueantes

1. **Design system obrigatório ignorado (contradição com CLAUDE.md).**
   - Onde: plano §4 D4 e D15; §5.1 "Fonte", "Superfícies", "Raios"; §5.4 "Botão". Motion §5.
   - Problema: o CLAUDE.md do projeto torna `docs/design-system.md` obrigatório ("Nunca criar cor, radius, spacing ou tipografia fora dos tokens definidos ali. Se algo não estiver coberto, PARE e pergunte"). Esse documento fixa: `#1e40af` (Deep Sapphire) como única cor de CTA; borda de 1px `#e5e5e5` no lugar de sombra; cartão com raio de 12px; botão de 8px; input com borda preta de 6px; Inter no corpo; Satoshi só a partir de 36px. O plano propõe índigo `#3b2dff` como CTA (D4), cartão com sombra e sem borda (§5.1), raio de 24 e 28px (§5.1), pílulas em controles (`venancor-scope.css:116`), peso 600 (D15) e Plus Jakarta Sans (§5.1). O plano nunca cita `docs/design-system.md` nem a regra do CLAUDE.md. A seção 4 (decisões do Vinicios) também não tem essa decisão. A única referência é `LITE_CHAT_DESIGN_SYSTEM.md` §10, que diz que o modo normal "segue o visual que já tinha".
   - Correção (texto pronto para colar na seção 4, como D0, antes de D1): "D0. Qual sistema de design governa o modo diretor. O CLAUDE.md torna `docs/design-system.md` obrigatório: #1e40af como única CTA, borda #e5e5e5 em vez de sombra, cartão de 12px, input com borda preta, Inter no corpo. O Lite (`LITE_CHAT_DESIGN_SYSTEM.md`) usa #3b2dff, Plus Jakarta Sans e pílulas. Opção A: o Lite passa a valer para o diretor; então `docs/design-system.md` ganha uma seção de exceção no mesmo PR da F0 e o `decision-log.md` registra a decisão. Opção B: o diretor segue `docs/design-system.md`; então a seção 5 do plano é reescrita com esses tokens. Nenhuma fase começa sem esta resposta." Acrescentar em F0 o pré-requisito "D0 respondida".

2. **Critério "com a chave desligada, nenhum pixel muda" é contradito pela própria F0.**
   - Onde: plano §6 F0, itens 6 e 7, "Pronto quando" de F0; §11 linha "Regressão no Lite do corretor"; §4 D5 e D6.
   - Problema: `src/components/arc/venancor-scope.css` é o escopo que 109 arquivos usam com `arc-venancor`, inclusive o Lite do corretor, do gestor e do supervisor (ex.: `features/broker-workspace/components/light-client-detail.tsx`). Os itens 6 e 7 mudam esse escopo para todos: `--control-height-sm` (linha 121) e as sombras de 1 camada (`--shadow-resting` na linha 114 e `--shadow-raised` na 55). O item 7 também remove gradientes do Lite, que aparecem em `components/chat/lite-welcome.module.css`, `week-ranking.module.css`, `assistant-avatar.tsx` e outros. O item 8 muda componentes Arc (pt-BR) usados pelo Lite. A proteção "chave" e "opt-out" não cobre nada disso, porque o Lite não passa por elas. O plano reconhece em D5 ("afeta o Lite inteiro") mas não corrige o critério de pronto.
   - Correção: dividir a F0 em F0a e F0b. "F0a (chave desligada = zero pixel): só tokens e seletores com `[data-skin="diretor"]`, provider, portais e tema, mais a tabela de alvos em px apenas dentro do escopo do diretor. F0b (Lite compartilhado, liberada pelo Vinicios com prints do Lite do corretor: Início, rail, lead, fila): D5 (sombra), D6 (gradientes do Lite), `--control-height-sm` no bloco `.arc-venancor` base e a troca de pt-BR nos componentes Arc." Reescrever o "Pronto quando" de F0a com a frase "com a chave desligada, nenhum pixel muda, inclusive no Lite".

3. **Escopo de papel: a chave por tenant também muda o modo normal de gestor e supervisor.**
   - Onde: plano §1 ("Gestor, supervisor e corretor no Lite continuam como estão"); §3.1 C0 (chave "por tenant, lida no layout"); §4 D1.
   - Problema: `features/broker-workspace/experience-mode.ts` (linhas 20-22 e 38-44) manda para o modo NORMAL o gestor sem `MANAGER_LITE` e o supervisor sem Lite. O ramo normal é o mesmo para diretor, gestor normal e supervisor normal. Com a chave ligada por tenant, esses usuários também recebem a pele, e o plano não tem nenhuma tela deles no catálogo nem no portão de QA. O §1 diz que o plano só muda o que "o diretor vê no modo normal", o que não é verdade pelo código.
   - Correção: incluir na seção 4 a decisão "D17. Papéis no modo normal": "Opção A: a pele vale para todo usuário no modo normal (é o mesmo chrome); então o portão da seção 8 inclui gestor normal e supervisor normal nas telas tocadas. Opção B: a chave só liga para `role === 'director'`, verificada no `(dashboard)/layout.tsx` junto com a chave." Acrescentar em C0: "a chave é avaliada junto com o papel (`role`)".

## Importantes

4. **Achados de contagem que não batem com o repo.**
   - Onde: plano §7 item "Pronto quando" de F1b, item 4 ("Os 9 arquivos com animação imperativa..."); anexo `inv-qualidade.md` "Totais" (9 telas, não arquivos).
   - Problema: o anexo conta 9 telas. O repo tem 14 arquivos com `requestAnimationFrame` (ex.: `components/app-shell.tsx`, `components/global-search.tsx`, `components/motion/count-up.tsx`, `features/journey/components/celebration-layer.tsx`) e mais de 18 com `animate(` (incluindo componentes Arc, como `arc/button/button.tsx` e `arc/switch/switch.tsx`). A lista de arquivos não está em lugar nenhum.
   - Correção: "F1b item 4: revisar os 14 arquivos com `requestAnimationFrame` e os 18 com `animate()` (lista gerada por `grep -rl` e anexada ao plano), e não 'os 9'". A lista precisa existir no anexo; hoje ela não está em nenhum documento.

5. **F2 item 6 cita "os 9 `error.tsx`".**
   - Onde: plano §6 F2 item 6.
   - Problema: o repo tem 7 `error.tsx` em `app/(dashboard)` (6 próprios e o da raiz do grupo) e 10 em `src/app`. O `inv-qualidade.md` diz "Error próprio: 6".
   - Correção: "F2 item 6: os 6 `error.tsx` próprios de `(dashboard)` mais o da raiz do grupo".

6. **Tamanho e abas de `/distribuicao` erradas.**
   - Onde: plano §6 F4, linha da Onda 5: "`/distribuicao` (6 abas, cerca de 8.000 linhas)".
   - Problema: `src/app/(dashboard)/leads/distribuicao/page.tsx` tem 927 linhas. `src/app/(dashboard)/distribuicao/page.tsx` tem 5 linhas e reexporta a outra. Não encontrei 6 abas no arquivo; elas podem estar em componentes filhos, mas não foram conferidas.
   - Correção: "Onda 5: `/distribuicao` (reexporta `/leads/distribuicao`, 927 linhas na página e os componentes filhos a contar; abas a confirmar)".

7. **Contagem de primitivas `ui/` e de importadores diverge.**
   - Onde: plano §2 item 9 ("65 arquivos") e F1 item 1 ("Button (303 importadores)").
   - Problema: `src/components/ui` tem 93 `.tsx` (64 sem prefixo `ds-`). Importam `components/ui/button`: 309 arquivos.
   - Correção: "§2 item 9: 93 arquivos `.tsx` em `components/ui` (no HEAD 5026f66e)"; "F1 item 1: Button, 309 arquivos".

8. **Base dos imports `@/components/ui` não é reproduzível.**
   - Onde: plano §2, linha "Imports de `@/components/ui` contra `@/components/arc`".
   - Problema: o plano diz "1.450 em 381 arquivos contra 121 em 48" e atribui ao Cinzel. Contando agora no HEAD: 1.647 linhas de import de `@/components/ui` em 443 arquivos, e 203 de `@/components/arc` em 81. A base (quais pastas entram) não está declarada, então o número não se repete.
   - Correção: declarar a base ("excluídas `components/arc`, `light`, `chat`; `src/**/*.tsx`") e atualizar os números com o HEAD atual.

9. **Animação "anel de 2px" conflita com a regra de movimento.**
   - Onde: motion §3, linha `LiteAttention`: "anel de 2px que some em 600ms".
   - Problema: motion §1 item 5 proíbe animar `box-shadow` e as seções 4 e 5 usam `LiteAttention` como o sinal de tempo real em tabelas, sino e kanban. Um anel por `box-shadow` ou `outline` anima exatamente o que a regra proíbe e custa caro em lista.
   - Correção: "`LiteAttention`: pseudo-elemento de 2px posicionado atrás do item, animado só com `transform: scale` (1 para 1,04) e `opacity` (0,5 para 0), 600ms, uma vez".

10. **"Sidebar recolher: largura via transform" não existe.**
    - Onde: motion §4, linha Sidebar.
    - Problema: `transform` não muda largura. Isso contradiz §1 item 5 ("nunca animar width") e deixa a implementação em aberto.
    - Correção: "Sidebar: largura em `grid-template-columns` com transição de 180ms (`ease.standard`); rótulos com fade de 120ms; sem animar `width`".

11. **`blur.soft` em números e textos.**
    - Onde: motion §2 (`blur.soft` "troca de texto e de número"); motion §3 `LiteNumber`.
    - Problema: `filter: blur` animado em cada número de dashboard e em cada troca de texto custa caro, e o princípio 7 pede 60 fps no notebook. Não há medição prevista.
    - Correção: "Números e textos: só `opacity` e `y` de 2px. `blur` fica só no título da página, uma vez, ou sai. Incluir na F1b o critério 'nenhuma tarefa longa acima de 50ms com o Performance aberto em `/dashboard`' já escrito em motion §7, com a medição antes e depois".

12. **Lista de camadas flutuantes incompleta (C5).**
    - Onde: plano §3.1 C5 e §2 item 5.
    - Problema: a lista de wrappers não inclui `src/components/ui/command.tsx` (a paleta Ctrl+K, que o D8 quer unificar), `src/components/ui/drawer.tsx` (base-ui Drawer, usado por `ui/drawer` e listado para remoção no §5.4) e `src/components/motion/success-overlay.tsx` (flutuante de sucesso). Sem eles, o item "camada flutuante sem escopo" da §11 não tem cobertura.
    - Correção: acrescentar em C5: "command (paleta Ctrl+K), drawer (base-ui), success-overlay; e o teste do provider deve cobrir todos os wrappers de `components/ui` com `Portal` ou `Popup`".

13. **F3 depende de uma pele de F1 que ainda não existe.**
    - Onde: plano §10, linha "2 (paralelo)": F3 parte 1 (`LiteSelect`, `LiteCombobox`, `LiteMenu`) em paralelo a F1.
    - Problema: esses componentes são construídos sobre `ui/select` e `ui/dropdown-menu` com pele. A pele é a entrega de F1 (§6 F1 item 1). Assim, a validação de print da F3 mede uma primitiva que ainda não tem o visual final.
    - Correção: "F3 parte 1 começa depois de F1 item 1 (Select, Dropdown e Popover com pele mergeados); enquanto isso, F3 só escreve testes de teclado e de estado."

14. **F1b item 2 muda o Lite que o corretor, o gestor e o supervisor já usam.**
    - Onde: plano §6 F1b item 2: "`light-motion.tsx` passa a reexportar o kit (gestor e supervisor ganham junto)".
    - Problema: `light-motion.tsx` tem `LitePageEnter`, `LiteList`, `LiteListItem` e `LitePress` (linhas 16, 42, 51 e 61) e é usado pelo Lite de três papéis. "Ganham junto" é uma mudança de comportamento no Lite sem chave e sem prints, a mesma falha de 09/10.
    - Correção: "F1b item 2: o kit novo convive com `light-motion.tsx`. Trocar o import dos três papéis é uma etapa própria (F0b), com prints do Lite de cada papel."

15. **Ordem de aprovação: prints só na Onda 1, mas F0 e F1 já mudam 309 arquivos.**
    - Onde: plano §8 item 4 ("aprovação do Vinicios nos prints antes de tirar a rota do opt-out") e §10.
    - Problema: F0 e F1 trocam primitivas usadas por centenas de arquivos antes de qualquer aprovação visual. É exatamente a sequência que levou à reversão de 09/10 (`3fdd31a0`, 2 arquivos; `c78cb73b`, 23; `338eb958`, a reversão de 87). O plano diz evitar isso, mas a aprovação continua no fim.
    - Correção: "Antes do merge de F1: prints de F0 e F1 no catálogo `/internal/design-system` aprovados pelo Vinicios (com a chave desligada e ligada). Sem essa aprovação, F1 não entra."

16. **Catálogo (plano-telas.md, que eu escrevi): `/roadmap` está errado.**
    - Onde: `plano-telas.md`, bloco `/roadmap` (Onda 8, "Re-skin por tokens; sem sombra").
    - Problema: `src/app/(dashboard)/roadmap/page.tsx:51` faz `redirect("/dashboard")` incondicional. O código abaixo é morto. O inventário qualidade conta `/roadmap` entre as 11 rotas só-redirect.
    - Correção: "`/roadmap`: nada para o diretor (redirect incondicional em `page.tsx:51`); código morto a remover (D12)". Ainda não aplicada no catálogo: a Parte 2 pediu para não mudar o restante. O bloco de `/roadmap` tem hoje duas afirmações contraditórias: a linha "Movimento" (criada na Parte 2) diz que não se aplica, e o "Critério de pronto" diz re-skin. Corrigir o critério quando o Maestro aprovar.

17. **Ondas do plano e do catálogo não batem.**
    - Onde: plano §6 F4 (tabela de ondas) contra `plano-telas.md` seção 1.
    - Problema: o plano põe em Onda 1 "clientes", "plantões do corretor" e "telas Lite de supervisor e gestor dentro do chrome normal". O catálogo põe `/clientes` na Onda 3 e `/plantoes/corretor/[brokerId]` na Onda 5. O plano põe `empresas` na Onda 3; o catálogo põe na Onda 1.
    - Correção: decidir uma regra e aplicar nos dois arquivos. Sugestão: Onda 1 = o que tem Lite reaproveitável direto (`clientes` tem `LightClientsList`, então sobe; `empresas` e `notificacoes` ficam na 1; `/plantoes/corretor` vai para a 5 porque depende de escopo de gestor).

18. **Portão de desempenho sem medição antes.**
    - Onde: plano §11 linha "Desempenho".
    - Problema: o plano pede "medir o LCP do `/dashboard` antes e depois", mas não define quando a medição antes é feita nem a meta. Sem a linha de base, a regra não é verificável.
    - Correção: "F0a item 11: medir LCP e a maior tarefa de `/dashboard`, `/leads` e `/conversas` no HEAD atual, com o Performance do Chrome, e registrar em `docs/implementations/active/2026-10-24-diretor-lite/baseline-desempenho.md`. Meta: nenhuma tarefa acima de 50ms causada por animação."

19. **Remoção de código morto aparece em dois lugares com regra diferente.**
    - Onde: plano §6 F0 item 9 ("em PR separado") e §10 linha "1 (paralelo)" (remoção do D12 na mesma ordem que F0).
    - Problema: o item 9 diz que a remoção está dentro da F0, e a tabela a põe como etapa paralela. O revisor não sabe qual vale.
    - Correção: "Remoção do D12 é etapa própria (linha 1 paralela), e F0 item 9 vira 'ver D12'".

20. **Chave "desligada no deploy" (D1) e "ligada por padrão para novos tenants" (F5 item 2).**
    - Onde: plano §4 D1 e §6 F5 item 2.
    - Problema: as duas frases não dizem o que acontece com tenants novos durante a transição.
    - Correção: "D1: a chave nasce desligada para todos. F5 item 2: após a aprovação do Vinicios, a chave passa a nascer ligada para tenants novos".

21. **Ação do F3 "LiteStagger" já tem nome no código.**
    - Onde: motion §3, linha `LiteStagger` / `LiteStaggerItem` ("base: idem", ou seja, `light-motion.tsx`).
    - Problema: o código tem `LiteList` e `LiteListItem` (linhas 42 e 51). "Idem" não diz que o nome muda.
    - Correção: "`LiteStagger` / `LiteStaggerItem`: renomeia `LiteList` / `LiteListItem` de `light-motion.tsx` com alias de compatibilidade".

22. **Gradientes do Lite: contagem diverge.**
    - Onde: plano §2, linha "Gradientes ... (mais 19 dentro do próprio Lite)".
    - Problema: uma busca por `gradient` e `from-` em `components/arc`, `light` e `chat` encontra 35 ocorrências. O número 19 não tem base declarada.
    - Correção: declarar o critério e recontar.

23. **Números de animação (motion) e de componente Lite (F3) sem entrada na lista de fases.**
    - Onde: motion §3 "`LiteSuccess` (check que se desenha)", "`LiteProgress`", "`LiteDrawLine`".
    - Problema: os três estão no kit (F1b item 2) e aparecem nos arquétipos da §5 de motion. Mas o §5 de motion usa `LiteSuccess` em Lista, Detalhe e Formulário, e nenhuma fase diz quem os escreve primeiro.
    - Correção: "F1b item 2: entregar os 15 componentes do kit antes da Onda 1, na ordem: `LitePageEnter`, `LiteStagger`, `LiteSwap`, `LiteNumber`, `LiteSuccess`, `LiteHighlight`, `LiteAttention`, `LiteReveal`; os demais podem vir com a onda que os usa".

## Menores

24. Motion §4, linha Gráfico: "barras crescem com `scaleY` de 0" distorce o raio dos cantos. Correção: animar `height` em SVG (`motion` com `pathLength` ou `transform` por barra com `transform-origin: bottom`) ou aceitar a distorção e documentar.
25. Motion §4, linha Gráfico: "pizza não existe (D: barras)". Texto cortado. Correção: "pizza não está no catálogo; usar barras".
26. Motion §4, linha Modal: "foco vai para o primeiro campo" não serve ao `LiteConfirmDialog` (sem campo). Correção: "foco vai para o botão de cancelar em confirmação destrutiva; para formulário, o primeiro campo".
27. Motion §3, `LiteListPresence`: "altura colapsando" usa animação de altura, contra §1 item 5. Correção: usar `grid-template-rows` (0fr para 1fr), como a própria §1 indica.
28. Plano §2 "Telas sem loading próprio: 64" confere com o anexo (81 - 17), mas o repo tem 18 pastas de página com `loading.tsx` ao lado. Diferença de uma tela; correção: "17 ou 18, conforme o critério de herança; declarar".
29. `plano-telas.md` (meu): "qualification-hub-client.tsx (1.096 linhas)"; o arquivo tem 1.095 linhas. Corrigir para 1.095.

## Cinco mais graves

1. Item 1: design system obrigatório pelo CLAUDE.md contradito em CTA, bordas, raios e tipografia; sem decisão D0.
2. Item 2: "chave desligada, nenhum pixel muda" falso para a F0 (escopo `arc-venancor` compartilhado com 109 arquivos).
3. Item 3: o modo normal também é de gestor e supervisor; o plano não cobre esses papéis.
4. Item 14: F1b muda `light-motion.tsx` para os três papéis sem chave e sem prints (mesma falha de 09/10).
5. Item 17: ondas do plano e do catálogo se contradizem em cliente, empresas e plantões; o catálogo também tem `/roadmap` errado (item 16).

## Verificado e correto (para o Maestro não refazer)

- 92 `page.tsx` em `(dashboard)`; 11 só-redirect; 81 telas; 21/10/3/47 (confere com `inv-qualidade.md`).
- `dashboard-header.tsx` tem 65 importadores (confere).
- `motion-tokens.ts` tem os valores de `duration`, `ease` e `spring` citados no motion §2 (confere).
- `ed0af666` (23/10, conversas Lite), `3fdd31a0`, `c78cb73b` e `338eb958` (09/10) existem com os escopos citados.
- `/distribuicao` reexporta `/leads/distribuicao` sem o layout de bloqueio de gestor; o layout de `leads/distribuicao` bloqueia só `manager` (confere com redesign §7).
- `/roadmap` redireciona incondicionalmente (`page.tsx:51`); `/settings/feedback-templates` lança erro para corretor; `/internal/design-system` não tem checagem de papel; `/assinatura` e `/propostas` não checam papel na página (confere com redesign §7).
- `createPortal` em `components/motion/select.tsx:324` e `<Toaster />` em `app/layout.tsx:115` estão nos lugares citados.
- Fonte Plus Jakarta Sans existe e está no layout raiz (`app/layout.tsx:3,13`). A afirmação está certa, mas não confere com `docs/design-system.md` (item 1).
