# Fase 2 do app do corretor: ideias tiradas da referência (Salte)

Fonte: `ancorahub/REFS_CORRETOR/referencia.mp4` (2min12s, gravação do app Salte, para clínicas). Analisado quadro a quadro em 2026-10-12 (182 quadros por mudança de cena). Tempos entre parênteses apontam o momento no vídeo. O Salte é a mesma linguagem do nosso Lite (mascotes, Início em conversas, respostas A/B/C/D), então quase tudo se traduz direto para o corretor.

Legenda: ✅ já temos · 🟡 temos parecido, dá para melhorar · 🆕 novo.

## 1. O que eles fazem que nós ainda não fazemos (maior impacto)

### 1.1 Configurar cada assistente conversando (🆕, prioridade alta)
- (31s–62s) Cada assistente "nasce" no chat ("Otto nasceu neste chat"), se apresenta e faz 4 a 5 perguntas com opções ("A que horas eu mando as confirmações?", "E se o paciente pedir para remarcar?", "No fim, o que você quer saber?"), com a barra "Combinando a função de Otto · 2 de 5".
- No fim mostra a **Ficha do assistente** ("Confere se eu entendi direito": O que faz, Onde, Quando com selo *Rotina*, Sozinho, Entrega) com **Ajustar / Está certo**, depois "Rotina criada · Desfazer" e "A primeira vez é amanhã, 10:00".
- **Para o corretor:** a Agenda pergunta a que horas lembrar os retornos e se manda resumo no fim do dia; o Leads pergunta se já sugere a 1ª mensagem e em quanto tempo cobrar o lead sem resposta; o Plantão pergunta se avisa 30 min antes. Vira rotina com horário, editável e com desfazer. É o "o corretor não se sente perdido" com o assistente trabalhando sozinho.

### 1.2 "Conecte para eu começar" por assistente (🟡 → 🆕)
- (31s, 40s) Card com as integrações que aquele assistente precisa (Amigo "Ler a agenda e os telefones", Google Agenda, Gmail, Portal da prefeitura), cada uma com uma linha do porquê, e "Agora não".
- **Para o corretor:** WhatsApp (já temos o fluxo), Google Agenda (retornos aparecem na agenda do celular), e-mail. O card fica no topo da conversa do assistente até conectar, com o selo "Próximo" no Início (25s) indicando qual configurar agora.

### 1.3 Blocos de dados vivos dentro da conversa, chamados por @ (🟡 → 🆕)
- (63s–100s) O "@" abre um menu com **Recentes** ("Agenda de amanhã", "Faturamento por dia, últimos 30 dias", "Quem não confirmou de hoje"), **Workers** e **Agendas**. Cada escolha vira um bloco interativo no chat:
  - Agenda com abas **Lista / Dia / Semana**, navegação de data, filtro, botões **expandir (⤢)** e **recolher (—)**, e ações em massa ("Confirmar as 11", "Ver todas as 43").
  - Faturamento com KPIs (receita, atendimentos, ticket médio, descontos, cada um com "vs anterior"), alternância **Gráfico / Tabela** e período.
  - "Quem não confirmou" com chips de estado por linha (*Não enviado*, *Sem resposta*, *Enviado ontem*) e "Enviar confirmação para os 4".
- Tocar numa linha abre uma folha com **Remarcar / Ver ficha / Perguntar sobre isto** (77s, 93s).
- **Para o corretor:** `@leads de hoje`, `@retornos de amanhã`, `@sem resposta` (com chips Novo / Sem resposta / Respondeu), `@minha produção do mês` (vendas, vidas, comissão estimada, vs mês anterior), `@plantão da semana`, `@lead Carla` (ficha). Ação em massa: "Mandar mensagem para os 4 sem resposta". Hoje nosso @ só abre outra conversa.

### 1.4 Ficha rápida do lead dentro da conversa (🆕)
- (78s–86s) A ficha do paciente abre como bloco/folha: **alerta em destaque** (amarelo: "Alergia a látex"), próxima consulta, última visita, telefone, saldo em aberto, convênio, pacotes, tags ("Retorno pendente"), CPF, nascimento; abas **Ficha / Histórico**; **Exportar / Fechar**; "Atualizado às 10:28".
- **Para o corretor:** alerta de atenção ("Sem resposta há 2 dias", "Prazo do 1º contato estourando", "Cotação vence amanhã"), operadora/plano, vidas e idades, última interação, próxima ação, tags, botão "Remarcar retorno" e "Perguntar sobre isto".

### 1.5 "Perguntar sobre isto" em qualquer item (🆕)
- (77s, 94s) Qualquer linha, card ou ficha tem a opção de abrir uma pergunta para a IA já com o contexto daquele item.
- **Para o corretor:** "Qual plano faz sentido para a Carla?", "Escreve uma mensagem de retomada". Depende da flag de IA e do consentimento (1.7).

### 1.6 Atendimento gravado com resumo (🆕, avaliar com jurídico)
- (102s–131s) Aba **Consultas** + botão flutuante **"Iniciar consulta"** → folha **"Antes de gravar"** (avisar o paciente; áudio processado por IA fora do Brasil; "Permitir e gravar", "Agora não", link para termo) → tela **"Nova consulta"** com transcrição ao vivo por falante, cronômetro, pausar, cancelar, **Finalizar** → **"Resumindo"** com barra iridescente e **"Pode sair desta tela. Eu aviso quando terminar."** → abas **Resumo / Transcrição** com **pontos principais com marcação de tempo**, "Copiar resumo", chips "Escrever a evolução" e "Agendar o retorno", e perguntas sobre a consulta.
- **Para o corretor:** "Registrar ligação/atendimento" (PME presencial, ligação de cotação): resumo com necessidades (vidas, idades, rede, orçamento), próximos passos, **etapa sugerida** e **retorno sugerido** com um toque. **Atenção LGPD:** dado de saúde; só com provedor pago, consentimento explícito do cliente e parecer jurídico.

### 1.7 Consentimento de IA antes de usar (🆕, necessário para ligar a IA)
- (66s) Folha **"Usar IA nas tarefas?"**: quem processa (Anthropic, Google), que dados (inclusive do paciente) e onde (fora do Brasil), "Ver detalhes", **Permitir / Agora não**, aceite do termo.
- **Para nós:** obrigatório antes de ligar a IA dos assistentes do corretor (a flag existe, mas está desligada por LGPD). Grava o aceite com data e versão do termo.

## 2. Interface e microinterações para copiar

| # | O que | Onde no vídeo | Status no nosso Lite |
|---|---|---|---|
| 1 | Status no cabeçalho do assistente: "Esperando você" / "Trabalhando…" / "Pensando" com o mascote iridescente | 33s, 59s | 🟡 temos status; falta "Trabalhando…" e o mascote pensando |
| 2 | Texto com brilho percorrendo ("Buscando faturamento…", "Buscando ficha do paciente") enquanto carrega | 67s, 78s | 🆕 |
| 3 | "Trabalhou por 2s ›", que abre o que o assistente fez | 96s | 🆕 |
| 4 | Ações sob cada resposta: copiar e refazer/desfazer, com a hora | 61s | 🟡 temos copiar |
| 5 | Placeholder muda com o contexto: "Responda aqui ou escolha uma opção acima" / "Escreva uma correção ou o próximo pedido" | 48s, 52s | 🟡 |
| 6 | Botão enviar vira **parar** (quadrado) enquanto o assistente trabalha | 52s | 🆕 |
| 7 | Chips de sugestão roláveis acima do compositor ("Escrever a evolução", "Agendar o retorno") | 123s | 🆕 |
| 8 | Compositor com anexar, @, microfone (ditado) e enviar | 31s | 🟡 falta microfone e anexo |
| 9 | Blocos com **expandir para tela cheia** e **recolher** | 75s | 🆕 |
| 10 | Folhas (bottom sheets) com alça, que sobem com mola, para ações de um item | 77s | ✅ |
| 11 | Tour com fundo escurecido, recorte na área e balão com seta, "Próximo"/"Finalizar" | 24s–26s | ✅ |
| 12 | Selo "Próximo" ao lado do assistente que deve ser configurado agora | 25s | 🆕 |
| 13 | Marcador de sistema "X nasceu neste chat" e separador "Hoje, 10:27" | 31s | 🟡 temos separador de dia |
| 14 | Confirmação "Confere se eu entendi direito" antes de salvar algo importante | 59s | 🆕 |
| 15 | "Rotina criada · Desfazer" logo após criar | 61s | 🟡 temos desfazer no cancelar retorno |
| 16 | Ícone de computador no cabeçalho (continuar no computador) | 31s | 🆕 |
| 17 | Faixa de limite: "Restam 4 créditos hoje · Ver planos" | 127s | 🆕 (CorreTop: plano/créditos de IA) |
| 18 | Busca + "+" no topo do Início; abas segmentadas "Workers / Consultas" | 24s | ✅ |
| 19 | "Pode sair desta tela. Eu aviso quando terminar." para tarefas longas | 115s | 🆕 |

## 3. Primeiro acesso guiado (onboarding do corretor)
- (0s–24s) Splash com a marca → herói com foto e **mascotes flutuando em volta** (respiram e piscam) → "Uma equipe que trabalha enquanto você atende." → **Começar / Já tenho conta**.
- Passos curtos com transição de empurrar: **"Como quer ser chamado?"** (apelido) → **especialidade** numa folha com busca e seleção múltipla → **"Quais sistemas você usa?"** (grade de logos, marcar todos, Pular) → **"Monte sua equipe"** (cards dos assistentes com check, "Criar o meu próprio") → **"Pronto, Diogo!"** com os mascotes entrando → Início com o tour.
- **Para o corretor:** "Como quer ser chamado?", **operadoras/produtos que você vende** (seleção múltipla com busca), **unidade e plantões**, **"Monte sua equipe"** (quais assistentes ligar), **conectar WhatsApp**, "Pronto, José!" → vídeo de boas-vindas (já feito) → tour. Hoje temos o card de boas-vindas e o tour; falta coletar preferências que personalizam os assistentes.

## 4. Correções e refinamentos no que já temos
1. **Início:** mostrar o selo "Próximo" e a prévia do que cada assistente espera ("Conecte para eu começar"), em vez de prévias genéricas.
2. **Respostas com opções:** quando o assistente digita, as opções aparecem só depois do texto, em cascata (no Salte elas surgem esmaecidas e acendem, 48s), e a opção escolhida vira balão do usuário à direita (já fazemos; falta o esmaecer das não escolhidas).
3. **Barra de progresso do fluxo** ("Combinando a função · 2 de 5") fixa acima do compositor: usar em Cotação e em toda configuração guiada.
4. **Carregamentos** com mascote "pensando" e texto com brilho em vez de esqueleto parado.
5. **Ações em massa** nas listas (Fila, Agenda): "Mandar para os 4 sem resposta".
6. **Hora "Atualizado às 10:28"** nos blocos de dados, para o corretor confiar no número.

## 5. Ordem sugerida (fase 2)
1. **Consentimento de IA (1.7)**: destrava a IA dos assistentes com LGPD em dia.
2. **@ com blocos vivos (1.3) + ficha rápida (1.4) + folha de ações por item**: maior ganho no dia a dia, sem IA obrigatória.
3. **Configurar assistente conversando + rotinas (1.1, 1.2)**: retornos e cobranças automáticos, com a Ficha "confere se entendi" e desfazer.
4. **Microinterações (seção 2)**: status trabalhando/pensando, brilho, botão parar, chips de sugestão, expandir bloco.
5. **Primeiro acesso guiado (3)**: personaliza tudo acima.
6. **Atendimento gravado (1.6)**: só depois de parecer jurídico e provedor pago.

Monetização CorreTop (para depois): créditos de IA por dia/plano com a faixa "Restam N créditos · Ver planos".
