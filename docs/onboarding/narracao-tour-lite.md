# Roteiro de narração: tour do app do corretor (modo Lite)

Gerado de `src/components/chat/tour/tour-steps.ts` com `npx tsx scripts/generate-tour-narration.ts`. Não edite à mão: mude os passos no código e gere de novo.

## Como usar
1. Grave (ou gere com a ferramenta de voz) um áudio por passo, com o texto de **Narração**.
2. Salve cada um como **MP3** com o nome indicado em `public/onboarding/narracao/` (ex.: `00-apresentacao.mp3`).
3. Pronto: o tour toca o áudio sozinho ao entrar no passo. Sem o arquivo, o passo segue em silêncio. O corretor pode silenciar pelo botão de som.

Dica de voz: tom de colega, animado e calmo, 150 a 165 palavras por minuto; cada áudio com no máximo uns 20 segundos.

## 00-apresentacao.mp3 · Seu novo jeito de atender

- Tipo: intro · 10 XP
- Texto na tela: Em uns 3 minutos você conhece o app. A cada passo você ganha XP, e no fim leva o selo de pronto para atender.
- Duração estimada: 20s (53 palavras)

**Narração:**

> Olá! Que bom ter você aqui. O app do corretor da Âncora mudou: agora tudo funciona como uma conversa. Seus assistentes te dizem o que fazer, e você resolve com um toque. Vamos dar uma volta rápida? São uns três minutinhos, e no final você ganha o seu selo de pronto para atender.

## 01-inicio.mp3 · Este é o seu Início

- Tipo: spotlight · destaque: `home-header` · 10 XP
- Texto na tela: Tudo começa aqui: a lista das suas conversas. O que espera por você aparece primeiro.
- Duração estimada: 13s (35 palavras)

**Narração:**

> Este é o seu Início. Ele funciona como a lista de conversas de um aplicativo de mensagem: o que está esperando por você sobe para o topo, então você nunca precisa procurar o que fazer.

## 02-abas.mp3 · Assistentes e Leads

- Tipo: spotlight · destaque: `home-tabs` · 10 XP
- Texto na tela: Em Assistentes ficam as áreas do seu trabalho. Em Leads, cada cliente é uma conversa própria.
- Duração estimada: 13s (34 palavras)

**Narração:**

> Aqui você alterna entre duas visões. Em Assistentes ficam as áreas do seu trabalho, cada uma com um ajudante. Em Leads, cada cliente vira uma conversa: o número azul mostra quantos estão esperando você.

## 03-leads.mp3 · Leads: quem chegou e quem espera

- Tipo: spotlight · destaque: `thread-leads` · 10 XP
- Texto na tela: Avisa o lead novo, o primeiro contato que está atrasando e quem respondeu. Aceitar é um toque.
- Duração estimada: 14s (38 palavras)

**Narração:**

> Este é o assistente de Leads. Ele avisa quando chega um lead novo, quando o prazo do primeiro contato está apertando e quando um cliente respondeu. Para aceitar, recusar ou chamar no WhatsApp, é só tocar na resposta.

## 04-plantao.mp3 · Plantão: seu plantão

- Tipo: spotlight · destaque: `thread-plantao` · 10 XP
- Texto na tela: Mostra o plantão de agora ou o próximo: horário, fila e unidade. Pausar e voltar a receber ficam aqui.
- Duração estimada: 12s (33 palavras)

**Narração:**

> No Plantão você vê o seu plantão de agora, ou o próximo: horário, fila e unidade. Precisou sair um pouco? Pause por aqui, e volte a receber leads quando quiser, com um toque.

## 05-agenda.mp3 · Agenda: seus retornos

- Tipo: spotlight · destaque: `thread-agenda` · 10 XP
- Texto na tela: Lista os retornos do dia, avisa o que venceu e deixa reagendar sem sair da conversa.
- Duração estimada: 11s (28 palavras)

**Narração:**

> A Agenda junta os seus retornos do dia e te avisa quando algum venceu. Dá para falar com o cliente ou reagendar ali mesmo, sem abrir outra tela.

## 06-cotacao.mp3 · Cotação guiada

- Tipo: spotlight · destaque: `thread-cotacao` · 10 XP
- Texto na tela: Seis perguntas rápidas e você tem os planos mais em conta, prontos para mandar no WhatsApp.
- Duração estimada: 11s (30 palavras)

**Narração:**

> Na Cotação você responde seis perguntas rápidas, como para quem é, quantas vidas e a região, e recebe os planos mais em conta. Escolheu? Manda direto no WhatsApp do cliente.

## 07-desempenho.mp3 · Desempenho: seu dia em números

- Tipo: spotlight · destaque: `thread-desempenho` · 10 XP
- Texto na tela: Recebidos, aceitos, em atendimento e a sua meta, com um comentário rápido sobre o seu ritmo.
- Duração estimada: 11s (30 palavras)

**Narração:**

> Desempenho mostra o seu dia em números: quantos leads chegaram, quantos você aceitou e como está a sua meta. Ele ainda comenta o seu ritmo, para você saber onde focar.

## 08-insights.mp3 · Insights: o que fazer na conversa

- Tipo: spotlight · destaque: `thread-insights` · 10 XP
- Texto na tela: A IA lê suas conversas e te diz quem responder primeiro, o próximo passo e dicas práticas.
- Duração estimada: 14s (38 palavras)

**Narração:**

> Insights é o seu analista. A inteligência artificial lê as conversas com os clientes e te diz quem responder primeiro, qual é o próximo passo e dá dicas práticas, como tratar uma objeção ou quando propor o fechamento.

## 09-ancora.mp3 · Âncora: os avisos da empresa

- Tipo: spotlight · destaque: `thread-ancora` · 10 XP
- Texto na tela: Escala publicada, recados da gestão e alertas chegam aqui, em ordem, como mensagens.
- Duração estimada: 11s (30 palavras)

**Narração:**

> Este é o canal oficial da Âncora. Escala publicada, recados da gestão e alertas importantes chegam aqui, em ordem, como mensagens. O selo azul mostra que é a empresa falando.

## 10-desafio.mp3 · Desafio rápido

- Tipo: demo-reply · 30 XP
- Texto na tela: Chegou Maria, PME, 3 vidas, há 2 minutos. O que você faz?
- Duração estimada: 8s (22 palavras)

**Narração:**

> Agora é a sua vez! Chegou a Maria, plano empresarial, três vidas, há dois minutos. Escolha a melhor resposta. Acertou, ganha bônus.

## 11-aviso.mp3 · Lead novo chega assim

- Tipo: demo-notice · 10 XP
- Texto na tela: O aviso desce do topo da tela. Toque em Atender e a conversa abre. Se não puder agora, ele fica guardado no topo.
- Duração estimada: 16s (42 palavras)

**Narração:**

> Quando um lead novo chega, o aviso desce do topo da tela, como no seu celular. Toque em Atender e a conversa já abre. Se não der para ver na hora, ele fica guardado como uma pílula no topo, sem se perder.

## 12-botao.mp3 · O botão da próxima ação

- Tipo: spotlight · destaque: `home-pill` · 10 XP
- Texto na tela: Ele sempre mostra o que fazer agora: atender quem espera ou começar um novo atendimento.
- Duração estimada: 12s (32 palavras)

**Narração:**

> Esse botão azul é o atalho da próxima ação. Se alguém está esperando, ele mostra o nome: é só tocar para atender. Se está tudo em dia, ele abre um novo atendimento.

## 13-busca.mp3 · Buscar e criar

- Tipo: spotlight · destaque: `home-tools` · 10 XP
- Texto na tela: A lupa procura pelo nome na aba aberta. O mais abre os atalhos: buscar um lead, ver o plantão e, quando liberada, a cotação.
- Duração estimada: 14s (38 palavras)

**Narração:**

> A lupa procura pelo nome dentro da aba que está aberta, assistentes ou leads. E o botão de mais abre os atalhos: buscar um lead, ver o seu plantão e, quando estiver liberada para você, fazer uma cotação.

## 14-mais.mp3 · Seu menu

- Tipo: spotlight · destaque: `home-me` · 10 XP
- Texto na tela: Nas suas iniciais ficam disponibilidade, clientes, configurações, este tour e o que mais estiver liberado para você.
- Duração estimada: 11s (30 palavras)

**Narração:**

> Tocando nas suas iniciais você abre o seu menu: a sua disponibilidade para receber leads, clientes, configurações, o que mais estiver liberado para você, e este tour, se quiser rever.

## 15-final.mp3 · Pronto para atender!

- Tipo: finale · 20 XP
- Texto na tela: Você concluiu o tour e ganhou o selo. Agora é com você: o que espera por você está no topo.
- Duração estimada: 13s (34 palavras)

**Narração:**

> Parabéns! Você concluiu o tour e ganhou o selo de pronto para atender. A partir de agora, é só abrir o app: o que precisa de você vai estar sempre no topo. Boas vendas!

