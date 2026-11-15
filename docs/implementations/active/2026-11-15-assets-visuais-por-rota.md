# Assets visuais sem mascote por rota

**Status:** dez artes por área, entrada do PWA no dashboard e avatares de rota 20% menores integrados sobre o topo remoto atual. Build de produção, type-check, lint direcionado, documentação e testes focados passaram. A confirmação visual no preview 3005 está pendente porque a porta não respondeu a HTTP.
**Prioridade:** P1 atual, substitui temporariamente ERP geral conforme foco semanal.

## Objetivo e contexto

Trocar as artes repetitivas do Capitão/ajudante que hoje aparecem como avatares dos assistentes. Cada rota deve ter um objeto/ilustração que comunique a atividade, sem Jack, personagens, rostos ou símbolo de âncora repetido. Manter a paleta do design system e a linguagem 3D polida da marca, com composição simples para leitura em 32–44 px.

## Mapa visual

| Área | Arte própria |
|---|---|
| Leads | cartão de oportunidade com lupa e marcador de novo contato |
| Carteira/Clientes | pasta com fichas organizadas, sem pictogramas de pessoas |
| Plantão | sino de atendimento e relógio |
| Agenda | calendário com data marcada e confirmação |
| Cotação | fichas de planos comparadas com escudo de saúde |
| Desempenho | gráfico crescente e medalha |
| Dicas de Atendimento | lâmpada e nota prática |
| Jornada | mapa com caminho, origem e destino |
| Equipe | cartões de pessoas abstratos ligados em rede, sem rosto |
| Mensagens | balões de conversa e envelope |

## Escopo de implementação

- Gerar uma imagem transparente por área, sem texto, watermark, personagem ou marca repetida.
- Salvar os assets otimizados em diretório semanticamente neutro e atualizar o mapa tipado do avatar contextual existente.
- Atualizar os contratos de design e o registro de implementação, preservando o controle `feature_ui_contextual_illustrations`, dimensões, alt vazio e fallback abstrato.
- Não alterar Jack/Notificações, marca verificada, avatares pessoais, estados, links, layout, permissões, tokens, regras de negócio ou dependências.

## Ajuste de escala da lista lateral

O avatar das áreas com `avatarAsset` é exibido a 35 × 35 px (aprox. 20% menor que os 44 px anteriores), centralizado no slot de 44 × 44 px já reservado pela linha. Assim o ícone fica mais leve sem reduzir o alvo da linha nem alterar Jack/Notificações, iniciais de leads ou avatares pessoais. Com a flag visual desligada, a forma abstrata de fallback também respeita os 35 px.

## Verificação visual

As pranchas de 44 px foram revisadas em fundo claro e escuro. Cada rota tem objeto principal distinto, sem personagem e com leitura clara no tamanho de avatar. As fichas de Carteira foram simplificadas para não repetir os símbolos abstratos de pessoas usados por Equipe.

## Geração e prompt set

Ferramenta: `image_gen` integrado, uma geração por asset; a imagem de Leads precisou de uma edição adicional para remover o quadriculado gerado como fundo e preservar o alpha. O prompt comum pediu ilustração 3D suave para interface, formas arredondadas, luz de estúdio discreta, composição central reconhecível a 40 px, fundo realmente transparente e paleta `#002B73`, `#0B5ED7`, `#00B26B`, `#7ED957`, `#FFC400`, `#FFF6E9`, `#1F2937`. Todas as peças proíbem Jack, mascote, personagens, rosto, âncora, pirata, texto, letras, números, marca d'água e cenário.

| Asset | Prompt específico |
|---|---|
| Leads | Cartão de contato com busto geométrico sem rosto, lupa dourada e marcador verde de novo lead; sem símbolos médicos. |
| Carteira | Pasta navy com folhas de registro, separadores coloridos e clipe dourado, sem pictogramas de pessoas. |
| Plantão | Sino de atendimento dourado, relógio navy e indicador verde de disponibilidade. |
| Agenda | Calendário navy, data dourada e selo de confirmação verde. |
| Cotação | Dois cartões de planos comparados, seleção verde e escudo dourado. |
| Desempenho | Gráfico navy de barras crescentes, seta verde e medalha dourada. |
| Dicas | Lâmpada dourada e nota clara com confirmação verde. |
| Jornada | Mapa navy com caminho pontilhado, origem verde, destino dourado e bússola. |
| Equipe | Três cartões de perfil geométricos, sem rosto, conectados por um nó verde. |
| Mensagens | Dois balões de conversa navy/creme, envelope dourado e ponto verde não lido. |

## Evidência visual e técnica

- Os dez originais têm 1254 × 1254 px; as saídas finais em `public/assistant-areas/` são WebP de 160 × 160 px, com alpha verdadeiro, entre 5.3 e 7.7 KB cada.
- Revisão em miniatura: `design/assistant-areas/visao-geral.png`; tamanho do avatar (44 px): `design/assistant-areas/visao-geral-44px.png`; contraste escuro: `design/assistant-areas/visao-geral-44px-escuro.png`.
- Sharp confirmou os dez arquivos em WebP com alpha real, 160 × 160 px; total de 60.170 bytes. Nenhum caminho antigo de asset permanece no código runtime.
- ESLint de `src/components/chat/assistant-avatar.tsx`, `git diff --check` e `npm run agent:docs` passaram (23 referências). Os testes existentes foram ajustados para `/assistant-areas/`.
- Preview `3005`: após alinhar o checkout do servidor ao commit `2224ac07`, `GET /` expirou em 5 segundos; a validação de HTTP 200 para a página e os dez assets fica pendente. O servidor não foi reiniciado.
- A conferência visual da redução de 20% fica limitada às linhas de Assistentes; o slot e o clique continuam com a dimensão anterior.
- O teste focado `src/components/chat/thread-row.test.tsx` passou (3/3); ESLint direcionado, `agent:docs` e `type-check` também passaram.
- Na integração preparada sobre `origin/feat/diretor-visual-lite` (ponta `6f3f8088`), `npm run type-check` passou; ESLint direcionado passou; `npm run agent:docs` validou 23 referências; Vitest focado passou em 5 arquivos (43 testes).
- `npm run build` passou na árvore runtime correspondente do preview `2224ac07`, com `SKIP_BUILD_TYPECHECK=1` e `NEXT_BUILD_FS_CACHE=1` (parâmetros do harness de build): compilação concluída e 170 páginas estáticas geradas.
- A suíte completa falha em `src/features/custom-roles/action-areas.test.ts`, que aponta seis arquivos de ação sem mapeamento. A falha é alheia à renderização de avatares.
- O `npm run lint` geral para no scanner de encoding por mojibake preexistente em quatro arquivos fora do escopo; ESLint direcionado dos arquivos alterados passou.
