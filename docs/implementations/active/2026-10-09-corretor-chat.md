---
type: plano
status: em-execucao
updated: 2026-10-09
tags: [crm, corretor, ux, p3, chat]
---

# Plano: modo corretor como chat (P3, 2026-10-09)

Pedido do Vinicios em 2026-10-09: reestruturar o modo corretor inteiro com a filosofia de um **app de chat**, em que as opções aparecem como **sugestões de resposta** (A, B, C...). Referências em `ancorahub/REFS_CORRETOR` (app "Salte"). Parte de crm-ancora. Substitui a direção visual de 2026-10-08-plano-app-corretor, aproveitando os dados e as ações que ela já criou.

Branch: `feat/corretor-chat` (worktree `Projects/ancorahub-chat`), base = `feat/dashboard-central` + `app-corretor-v1` (merge `f4b63a71`).

## O que as referências pedem (leitura das 11 imagens)
- **Início = lista de conversas**: avatar (mascote colorido), nome, selo de verificado, horário, prévia da última mensagem, **ponto azul** quando há novidade; prévia em azul quando a conversa espera você. Abas em controle segmentado ("Workers | Consultas"). Botão flutuante em pílula azul embaixo ("Iniciar consulta"). Topo: iniciais + "Olá, Ana" + busca + "+".
- **Conversa**: cabeçalho com voltar, avatar, nome e linha de estado ("Esperando você", "Trabalhando..." com ponto verde); separador de data centralizado ("Hoje, 09:41"); nota de sistema centralizada ("Teo nasceu neste chat"); mensagens do assistente em texto corrido (sem balão); mensagens do usuário alinhadas à direita.
- **Sugestões de resposta**: pergunta em negrito + lista A, B, C... com chevron; acima do campo, faixa de progresso ("Combinando a função de Teo · 0 de 5"); placeholder "Responda aqui ou escolha uma opção acima".
- **Cartões ricos no chat**: ficha (pares rótulo/valor), tabela, gráfico de barras, lista de referências recolhível; ações de linha ("Rotina criada: ... · Desfazer"); rodapé da mensagem com copiar, refazer e hora.
- **Trabalho visível**: "Vou buscar...", passos com ícone ("Abrindo o portal-nfse"), "Trabalhou por 6s >", mascote animado enquanto trabalha, botão de enviar vira **parar** (quadrado).
- **Comandos com @** no campo (`@agenda`, `@faturamento`, `@reativar`) que respondem com um cartão.
- **Bottom sheet** pra criar (nome, cor, formato) com "Cancelar" e ação principal azul.
- **Computador**: lista de conversas na lateral; centro com "Bom dia, Ana" + "Sua equipe" em cartões (estado "Esperando você", "Pausado", "+ Novo").

## Filosofia aplicada à Âncora
O corretor **conversa com assistentes**; cada assistente cuida de uma parte do trabalho e traz as decisões como **sugestões de resposta**. Nada de formulário solto: toda ação começa com uma pergunta clara e 2 a 7 opções. O campo de texto existe sempre (nota livre ou comando @), mas a opção é o caminho principal (1 toque).

Assistentes (fixos, gerados a partir dos dados reais, sem IA obrigatória):
| Assistente | Mascote | O que traz | Origem dos dados |
|---|---|---|---|
| **Âncora** (verificado) | logo | Avisos da equipe, escala publicada, novidades | notificações + avisos de equipe |
| **Leads** | Mochi azul | Lead novo oferecido, SLA em risco, cliente respondeu | `getBrokerWorkspaceData` (inbox, nextAction, queue) |
| **Plantão** | Onigiri laranja | Plantão agora / próximo, pausa, presença presencial | `duty` do workspace + calendário |
| **Agenda** | Cubo verde | Retornos e tarefas do dia | `agenda` |
| **Cotação** | Favo roxo | Simulador guiado como conversa | simulador existente |
| **Desempenho** | Nuvem rosa | Números do dia e do mês, meta | `today` + `goal` |
| **Insights** | Salte S | Resumos da IA por cliente | Insights existente |

E **cada lead é uma conversa própria** (aba "Leads" do Início).

## Kit do chat (componentes novos, `src/components/chat/`)
1. `AssistantAvatar` (SVG: formato mochi/onigiri/cubo/favo/nuvem/salte + cor + olhos; estados idle, trabalhando (respira/pisca), esperando (ponto azul)).
2. `ThreadRow` (avatar, nome, verificado, hora, prévia, ponto azul, prévia azul quando espera você).
3. `ChatScreen` (cabeçalho com voltar + avatar + estado; área rolável que gruda no fim; composer fixo; safe area).
4. Mensagens: `DateSeparator`, `SystemNote`, `AssistantMessage` (texto + rodapé copiar/hora), `UserMessage` (direita), `TypingIndicator` (3 pontos), `WorkingTrace` ("Trabalhou por Xs >", passos recolhíveis).
5. `ChoiceList` (pergunta + opções A..G com letra, chevron, estado escolhido; teclado: letra seleciona) + `ChoiceProgress` ("Título · 0 de 5").
6. Cartões: `FactSheetCard` (rótulo/valor + "Ver ficha"), `ListCard` (linhas com hora/valor, ref 9), `MiniBarChartCard`, `ActionLine` ("Feito: ... · Desfazer").
7. `Composer` (textarea que cresce, anexo, @, microfone opcional, enviar circular azul que vira parar), `MentionMenu` (@leads, @plantao, @agenda, @cotacao, @desempenho; filtra ao digitar).
8. `FloatingPill` (botão flutuante azul) e `SheetForm` (bottom sheet, Cancelar + ação).

### Movimento (todas com reduced motion)
- Mensagem nova: sobe 8px + fade, 180ms, ease-out; em sequência, intervalo de 60ms.
- Antes de uma mensagem do assistente: indicador "digitando" 400 a 700ms (proporcional ao texto, teto 900ms).
- Sugestões entram depois da pergunta (stagger 40ms por opção).
- Escolher uma opção: a opção **voa** até virar a mensagem do usuário à direita (layout animation, `layoutId`), as outras somem (fade 120ms), e o progresso conta (+1).
- Trabalhando: mascote respira (scale 1 → 1.04, 1.6s), passos aparecem um a um.
- Lista do Início: linha com novidade entra com destaque leve e o ponto azul pulsa uma vez.
- Troca de tela: deslize horizontal curto (push/pop) no celular.

## Rotas e telas

### 1. `/dashboard` (Início)
- Celular: topo (iniciais, "Olá, {nome}", busca, "+"); `SegmentedControl` **Assistentes | Leads**; lista de `ThreadRow`; `FloatingPill` "Novo atendimento" (abre sheet: buscar lead, criar lead, iniciar cotação).
- Assistentes: ordem por "espera você" > novidade > hora. Prévia = a última frase gerada (ex.: Leads: "Chegou um lead PME. Aceita?" em azul).
- Aba Leads: um `ThreadRow` por lead do corretor (prévia = último evento ou última mensagem do WhatsApp; azul quando espera ação).
- Computador: lista na lateral (360px) + centro "Bom dia, {nome}" com cartões dos assistentes (estado embaixo) e um cartão "Plantão agora".
- Busca: filtra conversas e leads pelo nome/telefone.
- **Pronto quando:** abrir o app mostra o que espera o corretor em 1 olhada e 1 toque abre a conversa certa.

### 2. Conversa de assistente `/dashboard/c/{assistente}` (rota nova dentro do prefixo permitido)
Roteiro gerado dos dados; exemplos:
- **Leads**: "Chegou {nome}, PME, 3 vidas, da campanha X, há 2 min." A Aceitar · B Ver a ficha · C Recusar (pede motivo em nova pergunta: A Não atendo PME · B Sem horário · C Outro). Depois de aceitar: "Aceito. Quer chamar no WhatsApp agora?" A Abrir WhatsApp · B Ligar · C Depois.
- **Plantão**: "Você está no PME 09:00 às 18:00, pronto pra receber." A Pausar 15 min · B Pausar até eu voltar · C Ver escala. Presencial pendente: "Aguardando o gestor liberar sua presença na unidade {x}."
- **Agenda**: "Hoje: 3 retornos." `ListCard` com hora/nome; A Começar pelo primeiro · B Reagendar um · C Ver todos.
- **Desempenho**: `FactSheetCard` com recebidos/aceitos/em atendimento/vendas + barra da meta; A Ver semana · B Ver mês.
- **Âncora**: avisos em ordem; escala publicada vira cartão "Seus plantões" (datas).
- **Cotação**: ver rota 5.
- **Pronto quando:** cada assistente resolve sua ação principal só com toques nas opções.

### 3. `/minha-fila` (Leads)
Vira a mesma aba "Leads" do Início em tela cheia (mantém a rota pra links antigos e notificações). Segmentado **Novos · Em atendimento · Retornos · Encerrados** como filtro da lista de conversas.

### 4. `/leads/{id}` (conversa do lead)
- Cabeçalho: voltar, avatar do lead (iniciais + temperatura), nome, estado ("Esperando você", "Em atendimento").
- Linha do tempo como chat: notas de sistema (chegou, aceito, 1º contato, cotação enviada, etapa), mensagens do WhatsApp quando houver, notas do corretor à direita.
- `FactSheetCard` fixo no topo ao abrir: tipo, vidas, operadora, origem, temperatura, telefone (privacidade mantida).
- Sugestões contextuais pela etapa: novo → A Chamar no WhatsApp · B Ligar · C Registrar contato · D Recusar; em atendimento → A Enviar cotação · B Agendar retorno · C Mudar etapa · D Registrar venda · E Marcar perdido; cada uma abre a próxima pergunta (ex.: Agendar retorno → A Hoje 18h · B Amanhã 10h · C Escolher data).
- Composer: nota livre (salva como interação) e `@cotacao` (abre a cotação já com o lead).
- **Pronto quando:** dá pra atender um lead do aceite à venda sem sair da conversa.

### 5. `/cotacao` (assistente Cotação)
Simulador guiado em perguntas: Para quem? (A Pessoa física · B Empresa/PME · C Adesão) → Quantas vidas? → Idades (chips) → Região → Preferências (A Com coparticipação · B Sem · C Tanto faz) → resultado com cartões de plano no chat + A Enviar ao cliente · B Salvar · C Refazer. Progresso "Montando a cotação · 2 de 5".

### 6. `/plantoes` (assistente Plantão em tela cheia)
Conversa do Plantão + `@plantao` mostra o calendário compacto (mês com dias marcados na cor do tipo, hover/toque abre o resumo do dia) e "Próximos plantões".

### 7. `/conversas/broker` (Insights)
Cada cliente com resumo da IA vira mensagem do assistente Insights; sugestões A Chamar agora · B Ver resumo completo · C Marcar como resolvido.

### 8. `/notificacoes` (assistente Âncora)
Lista de avisos vira o chat da Âncora (agrupado por dia), sem mudar a fonte de dados.

### 9. `/clientes`
Lista de conversas de clientes (vendidos), mesma `ThreadRow`; detalhe em `/clientes/{id}` como conversa (ficha + histórico).

### 10. `/settings`
Bottom sheet aberto pelo avatar (iniciais): disponibilidade (switch), aviso de lead, WhatsApp pessoal, tema, sair. Seções internas continuam como estão (já foram refeitas).

### 11. `/primeiro-acesso`
Vira uma conversa: "Oi, {nome}! Eu sou a Âncora..." perguntas com opções (A..) e campo de senha no composer; progresso "Configurando seu acesso · 0 de 4".

## Fases (uma por vez)
- **F0 Kit do chat** + tokens (azul de ação, superfícies, raios 16/24, sombra só em flutuantes) + testes de interação. 
- **F1 Início** (lista, abas, pílula, computador).
- **F2 Conversa do lead** (maior valor).
- **F3 Assistentes Leads, Plantão, Agenda, Desempenho, Âncora** (`/dashboard/c/...`).
- **F4 Cotação guiada.**
- **F5 Insights, Clientes, Configurações, Primeiro acesso.**
- **F6 Polimento:** sons/hápticos opcionais, revisão de acessibilidade, tema escuro, 390px.

## Regras de execução
- Mesmas ações e dados de hoje: as opções chamam as server actions já existentes (aceitar, recusar com motivo, registrar contato, mudar etapa, agendar retorno, pausar plantão). Sem backend novo na F0/F1.
- Arc UI já está no branch: usar `segmented-control`, `bottom-sheet`, `avatar`, `skeleton`, `empty-state`.
- Cada fase: tsc + testes + revisão do Vigia antes do commit; o Vinicios vê na 3001 (worktree `ancorahub-chat` precisa subir no lugar do `ancorahub-escala` quando for testar).
