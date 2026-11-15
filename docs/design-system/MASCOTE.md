# Mascote da Âncora Saúde · manutenção

Status: **componente e splash em produção de código desde 14/11/2026, com arte de reserva.** O personagem articulado (rig da Rive) ainda não existe: depende de redesenhar o mascote em camadas vetoriais (§2).
Dono: Vinicios. Faz parte do padrão de feedback (`FEEDBACK.md` §6). Referências e arte de reserva: `design/mascote/`.

## 1. O que existe

| Peça | Arquivo | O que faz |
|---|---|---|
| Componente | `src/components/mascot/mascot.tsx` (`<Mascot state="…" />`) | Mostra o mascote num estado. Usa a Rive quando há `.riv` e movimento ligado; senão, a arte de reserva |
| Contrato | `src/components/mascot/mascot-config.ts` | Estados, caminho do `.riv`, nomes da máquina de estados, arte de cada estado, textos acessíveis |
| Movimento provisório | `src/components/mascot/mascot-motion.ts` | Entrada, salto, balanço e respiração sobre a imagem inteira, com os tempos de `motion-tokens.ts` |
| Rive | `src/components/mascot/mascot-rive.tsx` | Runtime `@rive-app/react-canvas` (MIT), carregado por import dinâmico só quando precisa |
| Splash | `src/components/splash-screen.tsx` e `.module.css` | Fundo `#FFFFFF`, mascote no centro, vem no HTML do servidor e some quando o app fica pronto |
| Arte de reserva | `public/mascote/positivo.webp` (46 KB), `public/mascote/repouso.webp` (25 KB) | Recortes das pranchas aprovadas, fundo transparente. Fontes em `design/mascote/reserva/` |
| Prévia | `/dev/mascote` (só em desenvolvimento) | Todos os estados, demonstração do lead aceito, splash de novo e preferências |

Estados: `idle`, `welcome`, `loading`, `lead_accepted`, `lead_converted`, `success`, `error`.

| Estado | Quando usar | Arte de reserva | Movimento provisório |
|---|---|---|---|
| `idle` | repouso, telas vazias | repouso | parado |
| `welcome` | splash, primeira entrada | positivo | aparece, salta uma vez, assenta (1,9 s) |
| `loading` | esperando servidor ou IA | repouso | respira (1,6 s, só enquanto espera) |
| `lead_accepted` | aceite confirmado pelo servidor | positivo | um salto curto (0,56 s) |
| `lead_converted` | venda confirmada | positivo | dois saltos, o segundo menor (1,1 s) |
| `success` | outra confirmação | positivo | um salto curto |
| `error` | a ação falhou | repouso | balanço de 4 px, 2 ciclos, 250 ms |

Regras (de `FEEDBACK.md`): comemorar só depois da confirmação do servidor; nunca mostrar dados de cliente junto do mascote; nenhum loop fora de `loading`; respeitar `prefers-reduced-motion`, "Menos animação" e o kill-switch (o mascote fica parado e a Rive nem é carregada).

## 1.1 Animações pré-gravadas (Higgsfield)

Em 14/11/2026, três animações foram geradas no Higgsfield pelo MCP, com o modelo Wan 2.7 (3 créditos cada, 2 s, 720p). O primeiro e o último quadro foram fixados nas poses aprovadas, para o personagem voltar exatamente à pose:

| Arquivo | Do quadro → ao quadro | Usado em |
|---|---|---|
| `public/mascote/welcome.mp4` | positivo → positivo (pisca e sorri) | `welcome`, `success` |
| `public/mascote/lead-accepted.mp4` | repouso → positivo (levanta o polegar) | `lead_accepted` e a splash |
| `public/mascote/lead-converted.mp4` | positivo → positivo (punho no ar e salto) | `lead_converted` |

- Ficaram em H.264, 480 x 640, sem som, de 65 a 185 KB, com fundo branco puro e um pôster (primeiro quadro) em WebP. Originais e as imagens de entrada estão em `design/mascote/higgsfield/`.
- O `Mascot` toca o vídeo só com movimento ligado e tema claro. O branco some com `mix-blend-mode: multiply` sobre superfícies claras. No tema escuro, com movimento reduzido ou se o vídeo falhar, usa a arte de reserva. A arte fica visível até o vídeo começar a tocar.
- São vídeos, não um rig: não reagem nem misturam estados. O rig da Rive (§2 e §3) continua sendo o objetivo para um personagem articulado.
- Para gerar outra: envie a pose em fundo branco 768 x 1024 (como em `design/mascote/higgsfield/`), use `start_image` e `end_image` iguais à pose final, 2 s, 720p, câmera parada e sem cenário. Converta com o comando de ffmpeg da seção 7.

## 2. Por que ainda não é articulado

As referências (`design/mascote/referencias/`) são imagens achatadas: pranchas de 1536 px e GIFs de cerca de 410 px. Não há camadas, SVG nem `.riv`. Uma imagem inteira se movendo é só a reserva provisória. Para o rig, um designer precisa redesenhar em vetor, cada peça numa camada, com o ponto de giro marcado:

- Cabeça; cabelo (franja separada da nuca); bandana e as duas pontas soltas (balançam).
- Olhos: branco, íris, brilho; pálpebras superior e inferior (piscar); sobrancelhas.
- Bocas: neutra, sorriso fechado, sorriso aberto, surpresa, preocupada.
- Tronco e camisa; casaco (corpo e as duas abas da frente); medalhão; cinto e fivela.
- Braço e antebraço, esquerdo e direito.
- Mãos: aberta, punho, polegar para cima, acenando, apontando.
- Pernas e botas, esquerda e direita.

Formato aceito: arquivo do Rive Editor (`.rev`), SVG com grupos nomeados ou Figma com camadas. Cores de referência do dossiê (ainda não validadas como oficiais): azul `#0B4A8B`, verde `#22C55E`, dourado `#F8BF24`.

## 3. Contrato da Rive

O app espera, no `.riv`:

- Artboard **`Mascote`**.
- Máquina de estados **`Mascote`**, com uma entrada numérica **`estado`**: 0 `idle`, 1 `welcome`, 2 `loading`, 3 `lead_accepted`, 4 `lead_converted`, 5 `success`, 6 `error` (a ordem de `MASCOT_STATES`).
- Estados de uma passada (`welcome`, `lead_accepted`, `lead_converted`, `success`, `error`) voltam sozinhos ao `idle` dentro da máquina de estados. `loading` repete até o app mudar a entrada.
- Pivô do personagem embaixo e no centro (o app alinha com `Alignment.BottomCenter`).
- `idle` com piscada ocasional (a cada 4 a 6 s) e respiração muito leve; nada chamando atenção.
- Roteiro do `welcome` (dossiê §3): 0 a 0,4 s aparece; 0,4 a 0,8 s pisca e sorri; 0,8 a 1,4 s flexiona e salta; 1,4 a 1,9 s volta e faz positivo; depois repousa.

Para ligar o rig: salve o arquivo em `public/mascote/mascote.riv`, troque `MASCOT_RIVE.src` para `"/mascote/mascote.riv"` em `mascot-config.ts` e confira em `/dev/mascote`. A arte de reserva continua como fallback (sem WebGL, falha de carga, movimento reduzido). Para a splash usar a Rive também, troque a `<img>` de `splash-screen.tsx` pelo `<Mascot state="welcome" priority />` depois de medir o tempo de carga do runtime no celular.

## 4. Ferramentas e licenças

- **Runtime da Rive** (`@rive-app/react-canvas` 4.38.0): MIT, sem custo nem royalties. O runtime pesa cerca de 2 MB (wasm) e só é baixado quando um `.riv` é mostrado.
- **Rive CLI:** monta o `.riv` a partir de RML, no computador e sem conta. Instalação no Windows: `irm https://releases.rive.app/cli/install.ps1 | iex`; depois `rive create design/mascote/rive/mascote`. O projeto criado traz `AGENTS.md` e `CLAUDE.md` com a sintaxe.
- **Licença de exportação:** no plano Free, o `.riv` publicado leva a tela de abertura da Rive. Um `.riv` limpo exige o plano Cadet (US$ 9 por assento por mês, em 14/11/2026).
- **Motion AI Kit** (opcional, MIT): `npx motion-ai`.
- Nada de vídeo gerado nem chamada de API durante a splash: tudo é servido pelo próprio app.

## 5. Splash

- Arte aprovada em 14/11/2026: o capitão pirata com o sabre e a marca ÂNCORA, sobre o azul `#002B73` da própria arte (original em `design/mascote/splash/`). O capitão (`public/mascote/splash-capitao.webp`, 65 KB) e a marca (`splash-ancora.webp`, 24 KB) foram separados, com o azul removido, para o capitão entrar e dar um pulinho (1,9 s) enquanto a marca aparece 160 ms depois. O manifest usa o mesmo azul em `background_color`, para a tela do PWA instalado emendar com a splash. Esta arte é da splash; o `<Mascot>` das outras áreas segue com o personagem anterior até o visual delas ser decidido.

- Vem no HTML do servidor: aparece antes do JavaScript e emenda com a tela branca do PWA instalado (`background_color: #ffffff` no manifest).
- Some quando o app fica pronto: dois quadros depois da hidratação, respeitando só os 0,4 s de entrada. Nunca espera a animação inteira.
- Uma vez por sessão (`sessionStorage`, chave `__ancora_splash_shown`). Um script inline marca `html[data-splash="done"]` antes da pintura, então nada pisca nas próximas cargas.
- "Menos animação" (`ancora:a11y`) ou `prefers-reduced-motion`: mascote parado e saída sem transição.
- Só `transform` e `opacity`, sem bloquear cliques (`pointer-events: none`) e escondida do leitor de tela.

## 6. Como incluir um estado novo

1. Acrescente o nome no fim de `MASCOT_STATES`. Nunca reordene: o índice é a entrada da Rive.
2. Preencha `MASCOT_STATE_ART` e `MASCOT_LABELS`, e o movimento provisório em `mascot-motion.ts`.
3. No arquivo da Rive, crie o estado na máquina `Mascote` para o novo valor de `estado`.
4. Atualize as tabelas deste documento e rode `npx vitest run src/components/mascot`.

## 7. Como testar

- Conversão de um vídeo novo: `ffmpeg -i entrada.mp4 -an -vf "scale=480:-2:flags=lanczos:out_color_matrix=bt709:out_range=tv,lutrgb=r=if(gt(val,238),255,val):g=if(gt(val,238),255,val):b=if(gt(val,238),255,val),format=yuv420p" -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:v libx264 -profile:v main -crf 22 -preset slow -movflags +faststart public/mascote/nome.mp4`. O `lutrgb` só leva o fundo quase branco a branco puro e não mexe nas cores do personagem. Não use `curves` na imagem toda: ele clareia e desbota o mascote.

- `/dev/mascote` em desenvolvimento: estados, lead aceito com sucesso e falha, splash de novo e interruptores.
- Celular Android e PWA instalado: abra o app pela rede local ou pelo ambiente de teste e confira a splash, a saída e o desempenho no "Monitor de desempenho" do Chrome remoto (meta 60 fps).
- Movimento reduzido: ligue "Menos animação" em Configurações > Acessibilidade ou no sistema.

## 8. Vagas do mascote nas áreas

Cada área que pode mostrar o mascote já tem a vaga no código (`src/components/mascot/mascot-placements.ts`). Desligada, a vaga não desenha nada e a área fica como era. Para ligar, mude `enabled` para `true`; o estado e o tamanho também ficam ali.

| Vaga | Onde | Estado padrão | Hoje |
|---|---|---|---|
| `splash` | abertura do PWA | `lead_accepted` | ligada |
| `empty` | `EmptyState`, no lugar do ícone | `idle` | desligada |
| `error` | `RouteError`, no lugar do ícone | `error` | desligada |
| `loading` | `LitePageLoading`, acima do esqueleto | `loading` | desligada |
| `success` | overlay de sucesso; a venda registrada pede `lead_converted` | `success` | desligada |
| `celebration` | celebração da jornada (missão, conquista, nível), no lugar da arte | `lead_converted` | desligada |

Em `/dev/mascote`, "Mostrar todas as vagas" liga todas só neste aparelho e só em desenvolvimento, para ver cada área com o mascote antes de decidir.

Para trocar o visual de uma vaga: gere a pose (§1.1), salve em `public/mascote/`, aponte o estado em `mascot-config.ts` (`MASCOT_ART`, `MASCOT_STATE_ART` ou `MASCOT_VIDEOS`) e ligue a vaga.

## 9. Assets contextuais dos assistentes por rota

Em 15/11/2026, Vinicios pediu substituir as artes repetitivas com o Capitão/ajudante
por ilustrações de objetos próprios de cada área. As dez imagens usam a paleta oficial
(`#002B73`, `#0B5ED7`, `#00B26B`, `#7ED957`, `#FFC400`, `#FFF6E9`, `#1F2937`), fundo
transparente e nenhum texto, personagem, rosto, pirata ou símbolo de âncora repetido.

| Arquivo | Contexto visual |
|---|---|
| `public/assistant-areas/leads.webp` | Cartão de contato com lupa e marcador de novo lead |
| `public/assistant-areas/carteira.webp` | Pasta com registros e separadores coloridos, sem pictograma de pessoas |
| `public/assistant-areas/plantao.webp` | Sino de atendimento com relógio |
| `public/assistant-areas/agenda.webp` | Calendário com data marcada e confirmação |
| `public/assistant-areas/cotacao.webp` | Planos de saúde comparados com selo de seleção |
| `public/assistant-areas/desempenho.webp` | Gráfico crescente com medalha |
| `public/assistant-areas/dicas.webp` | Lâmpada e nota prática |
| `public/assistant-areas/jornada.webp` | Mapa com rota, origem e destino |
| `public/assistant-areas/equipe.webp` | Cartões de perfil abstratos conectados em rede |
| `public/assistant-areas/mensagens.webp` | Balões de conversa e envelope |

Cada arquivo mede 160 × 160 px, WebP com canal alfa e fica abaixo de 8 KB. A prancha
de revisão está em `design/assistant-areas/visao-geral.png`. O mapa tipado vive em
`src/components/chat/assistant-avatar.tsx`. A flag já auditada
`feature_ui_contextual_illustrations` controla sua exibição no Lite de corretor,
gestor e supervisor; o mesmo controle continua limitando ilustrações de seção/vazio
ao escopo anterior. Desligada ou em falha de carregamento, o avatar abstrato segue
visível.
O desenho é decorativo: estado, ação, nome e permissão continuam no conteúdo existente.
As ilustrações não substituem Jack/Notificações, a marca verificada, os avatares
pessoais ou os retratos dos leads. Sem rig, animação nova, dependência ou chamada de
rede externa. Plano, prompts e evidências:
`docs/implementations/active/2026-11-15-assets-visuais-por-rota.md`.
