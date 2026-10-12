# Vídeo de boas-vindas do corretor (~60s, narrado, motion graphics)

Data: 2026-10-12. Pedido do Vinicios: no primeiro acesso, um vídeo rápido de 30 segundos, narrado, no estilo do modo Lite, dizendo por que o sistema importa, como funciona e por que os feedbacks (registrar etapas) são importantes. Feito com o Opus, skills de motion e a CLI da ElevenLabs.

## Decisões

| Tema | Escolha | Por quê |
|---|---|---|
| Motion | **HyperFrames** (HeyGen, HTML + GSAP, render para MP4) | O vídeo vira HTML/CSS: reaproveita os tokens do Lite (`venancor-scope.css`), as fontes e os mascotes de verdade. Já temos skills GSAP no repo. Licença Apache 2.0. |
| Alternativa | Remotion (React) | Bom, mas licença de empresa acima de 3 pessoas (a Âncora passa disso); fica de plano B. |
| Voz | **ElevenLabs CLI oficial** (`@elevenlabs/cli`) | Pedido do Vinicios. Modelo multilíngue em pt-BR. Se a CLI não tiver o comando de voz, usar o SDK `@elevenlabs/elevenlabs-js` num script (mesma chave). |
| Onde aparece | No `LiteWelcome` (primeiro acesso), antes do tour | Já é o ponto de "primeira vez", já respeita o "Ver como" (marca em sessionStorage). |
| Formato | MP4 H.264 + WebM, 1080x1920 (celular) e 1920x1080 (computador), até ~3 MB cada, com pôster | Carrega rápido no 4G; o pôster aparece antes do play. |

## Roteiro (v3, aprovada a direção em 2026-10-12)

Formato: vídeo de **apresentação do produto** (tom de lançamento), só no primeiro acesso. Pode passar dos 30s: ~153 palavras, **~60s** na voz real.
Voz: **Liam** (`TX3LPaxmHKxFdv7VOQHJ`, premade multilíngue, modelo `eleven_multilingual_v2`, `pt`). O Andrey exige plano Creator; uso interno, não comercial (decisão do Vinicios).
Rascunho da narração: `video/boas-vindas/rascunho-v3-liam.mp3` (fora do git).

| # | Narração | Animação (estilo Lite) |
|---|---|---|
| 1 | "Seu dia de corretor acabou de mudar." | Tela escura, um ponto azul pulsa e vira a âncora; corte seco no ritmo da fala. |
| 2 | "Apresentamos o novo app do corretor da Âncora." | O celular entra girando de leve em 3D e acende no Início. |
| 3 | "Tudo o que importa agora cabe numa conversa. Seus assistentes acompanham cada lead, cada prazo e cada plantão, e te dizem qual é a próxima coisa a fazer." | Os mascotes (Plantão, Leads, Agenda, Jornada) entram em cascata como contatos; o balão "A próxima coisa é..." escreve sozinho. |
| 4 | "O lead chega, você aceita com um toque, e já está falando com o cliente." | Notificação de lead desce, dedo toca "Aceitar lead", transição de zoom para dentro da conversa. |
| 5 | "Conecte o seu WhatsApp, e a mensagem sai direto do app, com toda a conversa num lugar só." | QR code se monta e vira check verde; balões do WhatsApp voando para a conversa do app. |
| 6 | "Seus retornos ficam na Agenda. Seus plantões, na escala. E a sua fila, organizada por dia e horário." | Três cards em sequência rápida: retorno arrastado para o lado, calendário de plantões, fila com "Hoje" e "Ontem". |
| 7 | "E cada etapa que você registra conta. Mostra o seu trabalho para a gestão, ajuda a entender o que funciona, e vira pontos, missões e conquistas na sua jornada." | Etapas marcando uma a uma; linha conecta ao painel da gestão; "+10 pts", anel de nível enchendo, selo de conquista com brilho e confete. |
| 8 | "Ficou com dúvida? Pergunte onde fica, e o app te leva até lá." | Busca "Onde fica?" digitando "agenda" e a tela deslizando até lá. |
| 9 | "A Âncora está sempre evoluindo, pensando em quem está na linha de frente: você." | Afasta da tela: vários celulares com corretores diferentes; o do centro fica em destaque. |
| 10 | "Bem-vindo. Vamos juntos." | Logo da Âncora, botão "Começar" pulsando uma vez. |

Música: trilha leve de lançamento, baixa sob a voz (a confirmar; a ElevenLabs também gera música pela CLI).

## Passo a passo

### 0. Preparar (Vinicios, uma vez)
1. Instalar a CLI da ElevenLabs: `npm install -g @elevenlabs/cli` e `elevenlabs auth login`.
2. Gerar as skills da CLI para o Claude: `elevenlabs generate-skills` (cria um SKILL.md por grupo de comandos).
3. Instalar as skills de vídeo: `npx skills add heygen-com/hyperframes --full-depth --yes`.
4. Voz escolhida: Liam (`TX3LPaxmHKxFdv7VOQHJ`); o Andrey exige plano Creator.

### 1. Voz (Claude)
1. Rodar `elevenlabs --help` para confirmar o comando de texto para fala, o ID do modelo multilíngue e o formato de saída.
2. Gerar a narração cena por cena (5 arquivos) com timestamps por palavra, para a legenda e a animação baterem com a fala.
3. Juntar num `narracao.mp3` e conferir a duração (meta: 28 a 30s). Se passar, enxugar o texto, nunca acelerar a voz.

### 2. Motion (Claude + Cinzel)
1. Projeto em `video/boas-vindas/` (fora do bundle do app), com uma composição HTML por cena.
2. Estilo: copiar os tokens do Lite (cores, raio, sombras, fontes Geist/Inter), mascotes reais (`assistant-avatar`), telas recriadas em HTML a partir dos componentes, sem print borrado.
3. Movimento: molas curtas, uma coisa se mexendo por vez, nada de efeito gratuito (skills `animation-vocabulary`, `gsap-timeline`).
4. Áudio: a narração dirige a linha do tempo (cada cena começa no timestamp da fala dela). Música de fundo baixa opcional (a confirmar).

### 3. Loop de verificação (antes de mostrar ao Vinicios)
1. Renderizar com o HyperFrames.
2. Extrair quadros-chave (1 por segundo) e revisar: texto cortado, contraste, legenda sincronizada, ritmo, marca.
3. Corrigir e renderizar de novo até passar. O Vigia revisa o resultado final.
4. Medir: duração 30s ou menos, até ~3 MB, sem quadro preto no começo.

### 4. Colocar no app (Cinzel)
1. Arquivos em `public/onboarding/video/` (MP4, WebM, pôster, VTT).
2. Novo passo no `LiteWelcome`: o vídeo abre primeiro, com "Pular" visível desde o início, botão de som (começa mudo se o navegador bloquear o autoplay com som), legenda ligada.
3. Ao terminar ou pular: segue para o tour de sempre. A marca de "visto" usa o `seen-storage` (no "Ver como" fica só na sessão).
4. Acessibilidade: legenda, transcrição em texto, `prefers-reduced-motion` mostra o pôster e o texto em vez do vídeo, foco no botão de pular.
5. Flag no Super-admin para ligar e desligar o vídeo sem deploy.

### 5. Skill própria (depois do primeiro vídeo)
Transformar o que funcionou numa skill `video-ancora` (tokens, ritmo, voz, loop de verificação), para os próximos vídeos (tour do supervisor, novidades) saírem mais rápido. A cada vídeo, pedir para o Claude atualizar a skill com o que aprendeu.

## Pronto quando
No primeiro acesso de um corretor, o vídeo de 30s toca no celular e no computador, narrado e legendado, no visual do Lite, pode ser pulado, e depois segue para o tour; no "Ver como" ele aparece sem marcar como visto para o corretor.

## Riscos
- A CLI da ElevenLabs pode não ter o comando de texto para fala: aí uso o SDK oficial num script, com a mesma chave.
- Plano grátis da ElevenLabs pode não permitir uso comercial da voz: conferir o plano antes de publicar.
- Peso do vídeo no 4G: medir e comprimir; o pôster cobre a espera.
