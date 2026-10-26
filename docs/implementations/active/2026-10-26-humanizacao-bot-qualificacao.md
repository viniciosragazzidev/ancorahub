# Humanização das mensagens do bot de qualificação (WhatsApp)

Data: 26/10/2026. Pedido do Vinicios: toda mensagem que o bot de qualificação manda no WhatsApp deve fazer o lead se sentir acolhido e seguro. Este documento é só o plano. Nenhum código foi alterado.

Insumos:
- Inventário completo do Lince: `C:\Users\kyper\AppData\Local\Temp\opencode\dvl\resultado-mapa-bot.txt` (cada mensagem com arquivo:linha, quem decide o texto e riscos). Os números de linha citados abaixo vêm dele, lidos em `origin/feat/diretor-visual-lite`.
- Código principal: `src/features/qualification-engine/reply-composer.ts` (326 linhas nessa ref).

Regra de leitura: as 9 seções seguem a numeração do inventário. A seção 10 (configuração do diretor) não tem texto novo, só regras de precedência, tratadas no item 4.

---

## Status de implementação

- **F3 e F4 (esta branch, feat/humanizacao-bot-handoff)**: entregues em parcial. Commits c1114066, 5ea43126 e o da correção de revisão. Horário e feriados em `broker-window.ts`; handoffs, encerramento, respostas rápidas, objeção e fallbacks; texto do tenant vence fora do horário; promessa de não repetir só com resumo.
- **Faltam**: F5 (templates Meta, com reaprovação), F6 (medição), e a integração com `feat/humanizacao-bot-perguntas` (Cinzel) no handoff noturno. O `priceConcernLine` e as perguntas (F2) estão na branch do Cinzel.
- Registro em `docs/features-log.md` (26/10/2026).

## 1. Princípios de tom (acolhimento e segurança)

**Acolhimento**
- **Saudação pelo período**, no horário de São Paulo (America/Sao_Paulo, nunca o horário do servidor, que é UTC):
  - bom dia: 05h00 a 11h59
  - boa tarde: 12h00 a 17h59
  - boa noite: 18h00 a 04h59
- **Quando usar a saudação:** só na primeira mensagem da conversa (abertura) e na primeira mensagem depois de um silêncio longo (proposta: 6 horas sem mensagem nossa). Nas demais, não. Repetir "Bom dia" a cada pergunta soa robótico e foge da anti-repetição já existente.
- **Agradecer a resposta:** só quando o lead respondeu algo que preenche um campo. Na abertura, o agradecimento é "pelo contato" (o lead ainda não respondeu nada).
- **"Espero que esteja bem":** uma vez por conversa, na abertura. Nunca em toda mensagem.
- **Nome:** usar o primeiro nome na abertura e no encerramento. Nas perguntas do meio, usar só quando a mensagem não tiver outro reconhecimento. A regra atual de não repetir o nome em mensagens seguidas continua valendo.
- **Frase de porquê:** cada pergunta diz, em uma frase, por que estamos perguntando. Ex.: "Assim eu cotou o valor exato." Isso gera segurança, porque o lead entende o uso do dado.

**Segurança**
- Dizer o motivo de cada dado (acima).
- Dizer que a conversa continua com uma pessoa de verdade, quando o handoff acontece. Frase "sem você precisar repetir nada" quando o resumo já foi passado para o corretor.
- Dizer que o bot é assistente virtual quando perguntado (FAQ "quem é"). Transparência é parte da segurança, e não se deve esconder que é automático.
- Não prometer o que não é verificado. Afirmações sobre dados ("ficam só com a corretora", "não enviamos spam", "não compartilhamos") precisam de confirmação antes de entrar (ver risco 4).
- Sem pressão: nada de "última chance", "vagas acabando", "agora ou nunca".

**Forma**
- Limite de tamanho: 1 a 3 frases curtas, e no máximo uma pergunta por mensagem.
- No máximo 1 emoji, e opcional. Recomendação: nenhum nos textos de Meta (o emoji "👋" de `outbound-service.ts:754` sai).
- Nunca travessão, nem traço no lugar de vírgula. Teste automático vai barrar o caractere em toda variante.
- Português de WhatsApp como o aprovado em 23/10 ("pra", "você", "tá" com moderação). Sem "chamado(a)", "cadastro", "prezado".

---

## 2. Estrutura de cada mensagem

Ordem fixa, cada parte opcional quando não couber:

1. **Saudação pelo período** (só abertura ou retomada depois de silêncio). Ex.: "Bom dia, Neuza!"
2. **Reação ao que foi respondido** (agradecimento ou confirmação curta). Ex.: "Anotado, obrigado!"
3. **Frase de cuidado ou de porquê.** Ex.: "Assim eu já cotou o valor certinho."
4. **Pergunta**, com as palavras-chave do extrator intactas (ver item 4.2).

O exemplo do Vinicios ("Bom dia, [nome], obrigado pela resposta, espero que esteja bem! Contando com você, quantas pessoas vão entrar no plano?") cabe na estrutura, mas só na **primeira** mensagem da conversa, e com "obrigado pelo contato" no lugar de "obrigado pela resposta" (o lead escreveu primeiro, ainda não respondeu nada). Nas perguntas seguintes, o formato vira: reação + porquê + pergunta.

---

## 3. Texto novo, mensagem por mensagem

Legenda:
- **Atual**: texto como está hoje, com arquivo:linha do inventário.
- **Proposta**: 2 ou 3 variações. Cada variação entra no pool de `pick(…, seed)`, então a mesma seed continua dando o mesmo texto.
- Variáveis: `{nome}`, `{empresa}`, `{assistente}`, `{n}`, `{resumo}`, `{você}` etc. continuam as mesmas do código atual.
- Templates Meta: marcados com **[META]**. Precisam de reaprovação na Meta, e o botão casado por regex não muda.

### Seção 1: Saudação e abertura

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| 1ª resposta, com nome (`reply-composer.ts:241`) | `Oi, {nome}!` / `Olá, {nome}, tudo bem?` / `Oi, {nome}, tudo bem?` | `{Bom dia\|Boa tarde\|Boa noite}, {nome}!` (período de SP) |
| 1ª resposta, quem fala (`reply-composer.ts:240`) | `Me chamo {assistente} e falo da {empresa}` / `Aqui é da {empresa}` | `Me chamo {assistente}, da {empresa}.` / `Aqui é da {empresa}.` |
| 1ª resposta, fechamento (`reply-composer.ts:242`) | `Vou te ajudar com a cotação do seu plano de saúde.` / `Vou cuidar da sua cotação de plano de saúde.` / `Já te ajudo com o plano de saúde.` | Ver linha "1ª resposta, mensagem completa" abaixo |
| 1ª resposta, mensagem completa (novo) | (não existe; a composição é a da linha de cima) | **A:** "Bom dia, {nome}! Obrigado pelo contato, espero que esteja bem. Me chamo {assistente}, da {empresa}, e vou cuidar da sua cotação de plano de saúde." **B:** "Boa tarde, {nome}! Que bom receber seu contato, espero que esteja tudo bem por aí. Sou a {assistente}, da {empresa}, e já começo a sua cotação." **C:** "Boa noite, {nome}! Obrigado por chamar, espero que esteja bem. Aqui é da {empresa}, e já começo a preparar sua cotação de plano de saúde." |
| 1ª resposta, sem nome | `Oi!` / `Olá, tudo bem?` / `Oi, tudo bem?` | **A:** "Bom dia! Obrigado pelo contato, espero que esteja bem. Aqui é da {empresa}, e já começo sua cotação de plano de saúde." **B:** "Boa tarde! Que bom receber seu contato. Aqui é da {empresa}, e vou cuidar da sua cotação." **C:** "Boa noite! Obrigado por chamar. Sou a assistente da {empresa}, e já começo a preparar sua cotação de plano de saúde." |
| Abertura quando o lead ainda não escreveu (`conversation-state-machine.ts:671`) | `Olá! Vou fazer algumas perguntas rápidas para preparar seu atendimento. Para começar, qual é o seu {nome/cidade/tipo...}?` | **A:** "{Bom dia\|Boa tarde\|Boa noite}, aqui é da {empresa}! Espero que esteja bem. Pra preparar seu atendimento com calma, pode me dizer {promptLabel}?" **B:** "{Bom dia\|Boa tarde\|Boa noite}! Obrigado por aguardar, aqui é da {empresa}. Pra cuidar do seu atendimento, me conta {promptLabel}?" |
| Template default de saudação (`quick-reply.ts:289`) | `Olá! Vou fazer algumas perguntas rápidas para preparar seu atendimento.` | **A:** "{Bom dia\|Boa tarde\|Boa noite}! Obrigado pelo contato, espero que esteja bem. Vou fazer algumas perguntas rápidas pra preparar seu atendimento." **B:** "{Bom dia\|Boa tarde\|Boa noite}! Que bom falar com você. Vou fazer algumas perguntinhas rápidas pra cuidar do seu atendimento." |
| Abertura fora da janela de 24h, texto de fallback (`outbound-service.ts:754`) | `Olá *{nome}*! 👋 Somos da equipe de atendimento. Como podemos te ajudar a encontrar o melhor plano de saúde hoje?` | **A:** "{Bom dia\|Boa tarde\|Boa noite}, {nome}! Aqui é da {empresa}. Recebemos seu pedido de cotação de plano de saúde, espero que esteja bem. Posso te ajudar com isso por aqui?" **B:** "{Bom dia\|Boa tarde\|Boa noite}, {nome}. Vi o seu pedido de cotação de plano de saúde aqui na {empresa}. Quer que eu continue por aqui?" Sem emoji. |

Observação: texto livre fora da janela de 24h não pode ser enviado pelo WhatsApp. Esse fallback só vale dentro da janela ou como corpo de template aprovado. Ver risco 6.

### Seção 2: Perguntas da qualificação

Regra: toda pergunta mantém a palavra-chave do extrator (`nome`, `cidade`, `bairro`, `plano de saúde hoje`, `quantas pessoas/vidas`, `idade`/`quantos anos`, `e-mail`, e o vocabulário de plano). A frase de porquê entra depois da pergunta ou antes dela, nunca no lugar dela.

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Nome (`reply-composer.ts:84`) | `Pra eu te atender direitinho, qual é o seu nome completo?` / `Me diz seu nome completo, por favor?` | **A:** "Pra eu registrar tudo certinho, pode me dizer seu nome completo?" **B:** "Antes de tudo, qual é o seu nome completo? Assim eu já anoto direitinho pra você." **C:** "Pra eu te atender do jeito certo, me diz seu nome completo, por favor?" |
| Tipo de plano (`reply-composer.ts:87-89`) | `Me conta: o plano seria só pra você, pra sua família ou pra sua empresa (CNPJ)?` / `Você tá pensando num plano só seu, pra família ou pela empresa (CNPJ)?` / `O plano seria pra você, pra família ou pra empresa (CNPJ)?` | **A:** "Esse plano seria só pra você, pra sua família ou pra sua empresa (CNPJ)? Assim eu já busco o modelo certo." **B:** "Me conta, o plano é pra você, pra sua família ou pela empresa (CNPJ)? Com isso eu já sei por onde começar." **C:** "Pra eu montar as opções certas: é um plano só seu, pra família ou pra empresa (CNPJ)?" |
| Vidas, empresarial (`reply-composer.ts:92`) | `Quantas vidas a empresa quer colocar no plano, contando sócios, funcionários e dependentes?` / `E quantas vidas entram no plano da empresa, contando os dependentes?` | **A:** "Quantas vidas a empresa quer colocar no plano, contando sócios, funcionários e dependentes? Assim a cotação sai certinha." **B:** "E quantas vidas entram no plano da empresa, contando os dependentes? Com esse número eu cotou o valor exato." |
| Vidas, familiar (`reply-composer.ts:93`) | `Contando com você, quantas pessoas vão entrar no plano?` / `E quantas pessoas da família vão entrar, contando com você?` | **A:** "Contando com você, quantas pessoas vão entrar no plano? Assim eu já coto o valor pra família." **B:** "E quantas pessoas da família vão entrar, contando com você? Com esse número eu monto a proposta certinha." |
| Vidas, padrão (`reply-composer.ts:94`) | `Quantas pessoas vão entrar no plano?` / `E o plano seria pra quantas pessoas?` | **A:** "Quantas pessoas vão entrar no plano? Com esse número eu já consigo cotar o valor." **B:** "E o plano seria pra quantas pessoas, no total?" |
| Idade, empresarial (`reply-composer.ts:96`) | `E qual é mais ou menos a média de idade do pessoal?` / `Qual seria a idade média do grupo que vai entrar no plano?` | **A:** "E qual é mais ou menos a média de idade do pessoal? Isso ajuda a acertar o valor da mensalidade." **B:** "Qual seria a idade média do grupo que vai entrar no plano? Assim a proposta fica no ponto certo." |
| Idade, individual (`reply-composer.ts:98`) | `E qual a idade de quem vai usar o plano?` / `Quantos anos tem quem vai usar o plano?` | **A:** "E qual a idade de quem vai usar o plano? Isso ajuda a acertar o valor, que muda por faixa de idade." **B:** "Quantos anos tem quem vai usar o plano? Com isso eu calculo direitinho pra você." |
| Idade, N pessoas (`reply-composer.ts:99`) | `E quais as idades das {n} pessoas? Pode mandar só os números, tipo 35 e 32.` / `Me passa a idade de cada uma das {n} pessoas?` | **A:** "E quais as idades das {n} pessoas? Pode mandar só os números, tipo 35 e 32, que eu anoto tudo." **B:** "Me passa a idade de cada uma das {n} pessoas? Basta mandar os números, tipo 35 e 32." |
| Idade, sem contagem (`reply-composer.ts:100`) | `E quais as idades de quem vai entrar no plano?` / `Me passa a idade de cada pessoa que vai entrar no plano?` | **A:** "E quais as idades de quem vai entrar no plano? Pode mandar só os números, tipo 35 e 32." **B:** "Me passa a idade de cada pessoa que vai entrar no plano, assim eu já cotou certinho." |
| Cidade (`reply-composer.ts:103-104`) | `Em qual cidade e bairro você mora? Assim já busco opções com hospitais pertinho de você.` / `Me conta sua cidade e bairro, que eu procuro opções com rede perto de você.` | **A:** "Em qual cidade e bairro você mora? Assim eu já busco opções com a rede de hospitais perto de você." **B:** "Me conta sua cidade e bairro, que eu procuro opções com rede perto de onde você está." |
| E-mail (`reply-composer.ts:107`) | `Qual o seu melhor e-mail pra eu te mandar a cotação?` / `Pra qual e-mail posso te mandar a cotação?` | **A:** "Qual o seu melhor e-mail pra eu te mandar a cotação? Assim você revisa com calma." **B:** "Pra qual e-mail posso te enviar a cotação? Assim você olha no seu tempo." (Frases de privacidade, como "só uso pra isso", ficam de fora até confirmação, ver risco 4.) |
| "Já tem plano hoje?" (`reply-composer.ts:120-122`), singular | `E você já tem plano de saúde hoje? Se tiver, me conta qual, que eu comparo pra você.` / `Ah, e você já tem algum plano de saúde hoje? Se sim, qual?` | **A:** "E você já tem plano de saúde hoje? Se tiver, me conta qual, que eu comparo pra você, sem compromisso." **B:** "Ah, e você já tem algum plano de saúde hoje? Se sim, qual? Assim eu já sei o que levar em conta." |
| "Já tem plano hoje?", plural | `E vocês já têm plano de saúde hoje? Se tiver, me conta qual, que eu comparo pra vocês.` / `Ah, e vocês já têm algum plano de saúde hoje? Se sim, qual?` | **A:** "E vocês já têm plano de saúde hoje? Se tiverem, me contam qual, que eu comparo pra vocês, sem compromisso." **B:** "Ah, e vocês já têm algum plano de saúde hoje? Se sim, qual?" |
| Última pergunta, prefixo (`reply-composer.ts:215`) | `Pra fechar: {pergunta}` | **A:** "Por último, {pergunta}" **B:** "Pra fechar a cotação, {pergunta}" |
| Pergunta repetida, lead-in (`reply-composer.ts:211`) | `Só pra eu anotar certinho:` / `Pra eu seguir com a cotação:` / `Me ajuda só com uma coisa:` | **A:** "Sem pressa, mas preciso desse detalhe pra seguir:" **B:** "Pra eu não errar nada, me ajuda com isso:" **C:** "Acho que não consegui entender direito, então pergunto de novo:" |
| Definições internas (`qualification-engine/service.ts:80-130`) | Não vão ao cliente. São needles anti-repetição e prompt. | **Sem mudança.** Continuam como estão (ver item 4.2). |

### Seção 3: Confirmações (echo do que entendeu)

Regra: a confirmação reage ao que o lead disse e pode ter "obrigado" ou "anotado". As aberturas precisam variar (regra de `firstWord`, que já existe no código).

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Nome (`reply-composer.ts:155`) | `Prazer, {nome}!` / `Que bom falar com você, {nome}!` / sem nome: `Obrigado!` | **A:** "Prazer, {nome}! Obrigado por me dizer seu nome." **B:** "Que bom falar com você, {nome}! Obrigado por se apresentar." Sem nome: "Obrigado por se apresentar!" |
| Plano individual (`reply-composer.ts:158`) | `Só pra você, entendi!` / `Plano individual, combinado.` / `Beleza, {nome}, só pra você.` | **A:** "Entendi, é só pra você. Obrigado por me contar!" **B:** "Plano só seu, combinado. Obrigado pela informação." **C:** "Beleza, {nome}, então é um plano só seu." |
| Plano familiar (`reply-composer.ts:159`) | `Pra família, que ótimo!` / `Plano familiar, combinado.` / `Perfeito, {nome}, pra família.` | **A:** "Ótimo, então é pra família! Obrigado por me contar." **B:** "Pra família, combinado. Obrigado pela informação." **C:** "Perfeito, {nome}, então o plano é pra família." |
| Plano empresarial (`reply-composer.ts:160`) | `Pela empresa, ótimo!` / `Plano empresarial, combinado.` / `Beleza, {nome}, pela empresa.` | **A:** "Entendi, é pela empresa. Obrigado pela informação." **B:** "Plano empresarial, combinado. Vou montar a proposta direitinho." **C:** "Beleza, {nome}, então é pela empresa." |
| Vidas, 1 (empresarial) (`reply-composer.ts:164`) | `1 vida, anotado!` / `Beleza, 1 vida.` | **A:** "1 vida, anotado. Obrigado!" **B:** "Entendi, uma vida só." |
| Vidas, 1 (individual) (`reply-composer.ts:165`) | `Só você, beleza!` / `Uma pessoa, entendi.` | **A:** "Só você, combinado! Obrigado." **B:** "Uma pessoa, entendi. Obrigado pela informação." |
| Vidas, N (`reply-composer.ts:167`) | `{n} pessoas/vidas, anotado!` / `Beleza, {n} {pessoas/vidas}.` / `Perfeito, {nome}, {n} {unidade}.` | **A:** "{n} {pessoas/vidas}, anotado! Obrigado." **B:** "Beleza, {n} {pessoas/vidas} anotadas." **C:** "Perfeito, {nome}, são {n} {pessoas/vidas}." |
| Idade média, PME (`reply-composer.ts:170`) | `Média de {n} anos, anotado!` / `Beleza, anotei a idade média.` | **A:** "Média de {n} anos, anotado. Obrigado!" **B:** "Beleza, anotei a idade média do grupo." |
| Idade, 1 (`reply-composer.ts:172`) | `{n} anos, anotado!` / `Beleza, {n} anos.` / `Perfeito, {nome}.` | **A:** "{n} anos, anotado. Obrigado por passar!" **B:** "Beleza, {n} anos." **C:** "Perfeito, {nome}, já anotei." |
| Idades, lista (`reply-composer.ts:173`) | `Perfeito, anotei as idades!` / `Ótimo, idades anotadas.` | **A:** "Perfeito, anotei as idades. Obrigado!" **B:** "Ótimo, já anotei todas as idades." |
| Cidade e bairro (`reply-composer.ts:178`) | `{bairro, cidade, ótimo!}` / `Anotado: {lugar}.` / `Perfeito, {nome}.` | **A:** "{lugar}, anotado. Isso ajuda muito, obrigado!" **B:** "Anotei: {lugar}. Obrigado!" **C:** "Perfeito, {nome}, já anotei a sua região." |
| E-mail (`reply-composer.ts:181`) | `E-mail anotado!` / `Anotei seu e-mail, obrigado!` | **A:** "Anotado, obrigado! Sua cotação vai por esse e-mail." **B:** "E-mail anotado, obrigado por passar." |
| Resumo, 2 ou mais campos (`reply-composer.ts:192`) | `Anotei aqui: {resumo}.` / `Perfeito, anotei: {resumo}.` | **A:** "Obrigado! Anotei aqui: {resumo}." **B:** "Perfeito, obrigado pelas respostas. Anotei: {resumo}." |

### Seção 4: Handoff, pediu humano, fora do horário e encerramento

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Pediu pessoa, padrão (`reply-composer.ts:277`) | `Claro, {nome}! Já passei seu atendimento para um corretor especialista com o que você me contou ({resumo}). Ele continua a conversa por aqui em instantes.` | **A:** "Claro, {nome}, já passei seu atendimento para um corretor especialista, com tudo que você me contou ({resumo}). Ele continua por aqui em instantes, sem você precisar repetir nada." **B:** "Com certeza, {nome}. Já deixei o que você me passou ({resumo}) com um corretor especialista, e ele te responde por aqui em instantes." |
| Qualificação completa, padrão (`reply-composer.ts:278`) | `Obrigado, {nome}! Com essas informações ({resumo}), já passei seu atendimento para um corretor especialista. Ele continua a conversa por aqui em instantes.` | **A:** "Muito obrigado, {nome}! Já tenho o que preciso ({resumo}), então passei seu atendimento para um corretor especialista. Ele continua por aqui em instantes, sem você repetir nada." **B:** "Obrigado, {nome}! Com isso ({resumo}), seu atendimento já está com um corretor especialista. Pode ficar tranquilo, ele te chama por aqui em instantes." |
| Pediu humano, noite (`reply-composer.ts:286`) | `Claro, {nome}! Já passei seu atendimento para a nossa equipe com o que você me contou ({resumo}). O mais breve possível, o primeiro corretor disponível continua a conversa por aqui.` | **A:** "Claro, {nome}, já deixei tudo com a nossa equipe ({resumo}). Assim que a equipe começar o atendimento, o primeiro corretor disponível continua por aqui, sem você repetir nada." **B:** "Boa noite, {nome}! Já passei o seu caso para a nossa equipe ({resumo}). Assim que começarmos o atendimento, um corretor continua a conversa por aqui." |
| Qualificado, noite (`reply-composer.ts:285`) | `Obrigado, {nome}! Com essas informações ({resumo}), seu atendimento já está com a nossa equipe. O mais breve possível, o primeiro corretor disponível entra em contato com você por aqui.` | **A:** "Obrigado, {nome}! Com essas informações ({resumo}), seu atendimento já está com a nossa equipe. Assim que a equipe começar, o primeiro corretor disponível fala com você por aqui." **B:** "Boa noite, {nome}, muito obrigado! Já está tudo com a nossa equipe ({resumo}). Um corretor te chama por aqui assim que começar o atendimento." |
| Encerramento, dia (`closing-state-service.ts:88`) | `Obrigado pelas informações, {firstName}! Sua qualificação foi concluída e um de nossos corretores entrará em contato em instantes.` | **A:** "Obrigado pelas informações, {firstName}! Está tudo anotado. Um corretor vai falar com você por aqui em instantes." **B:** "Muito obrigado, {firstName}, foi um prazer! Já está tudo com um dos nossos corretores, que te chama por aqui em instantes." |
| Encerramento, noite (`closing-state-service.ts:87`) | `Obrigado pelas informações, {firstName}! Sua qualificação foi concluída. O mais breve possível, o primeiro corretor disponível entra em contato com você por aqui.` | **A:** "Obrigado pelas informações, {firstName}! Está tudo anotado. Assim que a equipe começar, o primeiro corretor disponível fala com você por aqui." **B:** "Boa noite, {firstName}, obrigado! Já está tudo com a nossa equipe. Um corretor te chama por aqui assim que começar o atendimento." |
| Cliente escreve depois do encerramento, 1x (`closing-state-service.ts:152`) | `Seu atendimento já foi encaminhado. Um corretor entrará em contato assim que estiver disponível.` | **A:** "Oi, {nome}! Seu atendimento já está com um corretor, e ele te responde por aqui assim que estiver disponível." **B:** "Recebi sua mensagem, obrigado! Seu atendimento já está com um corretor, que te responde por aqui." |
| Já com corretor humano (`quick-reply.ts:286`) | `Recebi sua mensagem. O corretor responsável já foi avisado e continuará seu atendimento por aqui.` | **A:** "Recebi sua mensagem, obrigado! O corretor responsável já foi avisado e continua seu atendimento por aqui." **B:** "Oi, {nome}! Já avisei o corretor responsável, que segue com você por aqui." |
| Lembrete enquanto espera humano (`quick-reply.ts:287`) | `Sua mensagem foi recebida. Reforcei o chamado para o corretor responsável.` | **A:** "Recebi sua mensagem e já avisei o corretor, que te responde por aqui em instantes." **B:** "Obrigado pelo retorno! Reforcei o seu chamado com o corretor responsável." |
| Lead volta à conversa (`quick-reply.ts:288`, sem uso ativo hoje) | `Olá novamente. Vou avisar o corretor que acompanhou seu atendimento.` | **A:** "Oi, {nome}! Que bom ter você de volta. Vou avisar o corretor que acompanhou seu atendimento." |
| Texto legado de handoff (`reply-composer.ts:301-302`, aposentado) | `Vou encaminhar você para um corretor da equipe agora.` / `Obrigado pelas informações. Vou encaminhar seu atendimento para um corretor da equipe agora.` | **Sem texto novo.** Continuam em `RETIRED_HANDOFF_TEXTS` (ver item 4.5). |
| Humano pedido, quick reply (`quick-reply.ts:291`, `conversation-state-machine.ts:1547-1548`) | Igual ao de "Pediu pessoa" acima, com variáveis renderizadas. | Usa a mesma proposta dos itens "Pediu pessoa" e "Pediu humano, noite". |
| Texto `human.requested` aposentado (`quick-reply.ts:313`) | `Certo! Estou transferindo seu atendimento para a fila de um corretor especialista agora mesmo. Para agilizar seu atendimento, pode me informar seu nome e para quantas pessoas busca o plano?` | **Sem texto novo.** Entra em `RETIRED_DEFAULT_BODIES` (item 4.5). |
| IA quebrada, fallback legado (`conversation-state-machine.ts`, ~linha 2070) | `Olá! Nosso atendente virtual está temporariamente indisponível. Já estamos direcionando seu contato para um de nossos corretores humanos!` | **A:** "Oi! Nosso atendimento automático está instável agora. Já estamos encaminhando seu contato para um corretor, que te responde por aqui." |

### Seção 5: Objeção, desistência e preço

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Instrução ao modelo para a 1ª objeção (`ai-agent/qualification-interpreter.ts:34-39`) | Mensagem curta, 3 frases, tom humano, sem promessa de preço/desconto/cobertura; acolhe, pergunta o motivo (1 pergunta) e oferece caminho. | Manter as regras de segurança (sem preço, desconto ou cobertura). Acrescentar: **acolher primeiro** ("entendo", "faz sentido"), **nunca** mais de uma pergunta, **nunca** culpar o lead, **sem** "infelizmente" nem "lamento", e pelo menos duas saídas concretas (comparar com o plano atual, cotar para outra pessoa, ligação ou voltar depois). Texto gerado ainda passa pelo filtro de travessão de `qualification-interpreter.ts:120`. |
| 1ª objeção, sem modelo (`conversation-state-machine.ts:1167-1168`) | `Entendi{, nome}. Posso te perguntar o motivo? Se você já tem plano, consigo comparar com o atual. Se for para outra pessoa da família, também cotamos. E se preferir, um especialista te liga.` | **A:** "Entendi{, nome}, obrigado por me avisar. Posso perguntar o que pesou? Se você já tem plano, eu comparo com o atual. Se for pra outra pessoa da família, também cotamos. E se preferir, um especialista te liga." |
| 2ª recusa, fechamento (`conversation-state-machine.ts:1863`) | `Tudo bem{, nome}. Obrigado pela atenção. Se mudar de ideia ou quiser cotar para outra pessoa, é só me chamar por aqui.` | **A:** "Tudo bem{, nome}, obrigado pela atenção. Fica à vontade pra voltar quando quiser, ou pra cotar pra alguém da família. É só me chamar por aqui." |
| Preço alto, 1 linha antes da próxima pergunta (`reply-composer.ts:321-324`) | `Entendi, o valor de hoje está pesando. Vou te ajudar a encontrar uma opção que caiba melhor no orçamento de {você/vocês}.` / `Entendi, a ideia é pagar menos sem perder um bom atendimento. Vamos buscar as melhores opções para {você/vocês}.` / `Faz sentido querer reduzir esse valor. Vou montar opções mais em conta para {você/vocês}.` | **A:** "Entendi, o valor de hoje está pesando. Vou procurar uma opção que caiba melhor no orçamento de {você/vocês}, com calma." **B:** "Faz sentido querer reduzir. Vou montar opções mais em conta pra {você/vocês}, e você escolhe com calma." **C:** "Entendi, a ideia é pagar menos sem perder atendimento. Vou buscar opções boas pra {você/vocês}." |
| Correção de dado, "não, são 2 vidas" (`conversation-state-machine.ts:1146`) | `Anotei a correção{, nome}: {resumo}. Já avisei o corretor, que continua a conversa por aqui.` | **A:** "Obrigado por corrigir{, nome}! Anotei: {resumo}. Já avisei o corretor, que segue a conversa por aqui." |

### Seção 6: Fallbacks de guardrail e versão legada

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Guardrail, pergunta pendente, prefixo (`fallback-response.ts:23-35`) | Prefixo `Perfeito, {nome}. ` / `Perfeito. ` | Trocar o prefixo por **`Obrigado{, nome}! `** / **`Obrigado! `**. "Perfeito" seguido de pergunta soa de formulário. |
| Guardrail, perguntas (`fallback-response.ts:23-35`) | `Como você prefere ser chamado(a)?` · `Em qual cidade você mora?` · `O plano seria individual, familiar ou empresarial?` · `Quantas pessoas serão incluídas no plano?` · `Para dimensionar as opções para a empresa, qual é a média aproximada de idade do grupo?` · `Quais são as idades das pessoas que serão incluídas?` · `Qual e-mail podemos usar para continuar o atendimento?` | Trocar `Como você prefere ser chamado(a)?` por **"Como você prefere que eu te chame?"** (tira o "(a)" de cadastro; confirmar que continua com a palavra-chave de nome). As demais seguem a seção 2, mantendo as palavras-chave. Ex.: "Em qual cidade você mora? Assim eu já busco opções perto de você." |
| Guardrail, sem pergunta pendente (`fallback-response.ts:40-43`) | `{nome}, recebi sua mensagem. Qual é o próximo detalhe que você gostaria de informar?` / `Recebi sua mensagem. Qual detalhe você gostaria de informar primeiro?` | **A:** "{nome}, recebi sua mensagem, obrigado! Me conta o próximo detalhe que você quiser, do seu jeito." **B:** "Recebi sua mensagem, obrigado! Qual detalhe você prefere me passar primeiro?" |
| Versão legada (`ai-agent/ai-response-schema.ts:151-176`) | `Perfeito, {nome}. Como você prefere ser chamado(a)?` / `{nome}, recebi sua mensagem. Pode me contar um pouco mais sobre o que você está procurando?` | Espelhar a proposta de `fallback-response.ts`, para o fluxo legado não divergir. Marcar como legado no código. |

### Seção 7: Quick replies terminais e de situação

Esses textos são o padrão. O diretor pode trocar em Atendimento > Situações, e a troca tem prioridade (item 4.4).

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Opt-out, LGPD (`quick-reply.ts:296`) | `Entendido. Registrei sua solicitação e o atendimento automático será interrompido.` | **A:** "Tudo bem, respeito sua escolha. Registrei seu pedido e não vou mais enviar mensagens automáticas por aqui. Se precisar, é só chamar." **B:** "Entendido, obrigado por avisar. Registrei seu pedido e o atendimento automático para por aqui. Se mudar de ideia, é só chamar." Não prometer apagar dados sem confirmação jurídica (risco 4). |
| Número errado (`quick-reply.ts:297`) | `Entendido. Vou interromper este atendimento e sinalizar o contato para a equipe.` | **A:** "Desculpa o incômodo, obrigado por avisar. Vou tirar esse número do nosso atendimento." |
| Mídia sem pergunta pendente (`quick-reply.ts:298`) | `Recebi o arquivo. O corretor responsável foi avisado para verificar.` | **A:** "Recebi, obrigado! Já avisei o corretor responsável pra dar uma olhada com calma." |
| Mensagem vazia ou incompreensível (`quick-reply.ts:299`) | `Recebi sua mensagem. Se preferir, posso encaminhar seu atendimento para um corretor.` | **A:** "Não consegui entender essa mensagem, tudo bem. Se preferir falar com uma pessoa, posso passar seu atendimento para um corretor." |
| Pediu ligação (`quick-reply.ts:300`) | `Certo. Vou avisar o corretor para retornar o contato assim que possível.` | **A:** "Combinado! Já avisei o corretor para te ligar assim que possível." |
| Urgente (`quick-reply.ts:301`) | `Entendi a urgência. Vou sinalizar o corretor responsável agora.` | **A:** "Entendi, vou avisar o corretor responsável agora mesmo, com prioridade." |
| Despedida (`quick-reply.ts:302`) | `Tudo bem. Quando precisar, estaremos por aqui.` | **A:** "Tudo bem{, nome}! Quando quiser retomar, é só me chamar por aqui." |
| Agradecimento (`quick-reply.ts:303`) | `Por nada! O corretor continua à disposição.` | **A:** "Imagina, foi um prazer! Qualquer coisa, é só chamar por aqui." |
| FAQ preço (`quick-reply.ts:292`) | `O valor depende principalmente da idade, da cidade e do tipo de plano. Com essas respostas o corretor já te manda as opções com preço.` | **A:** "O valor depende principalmente da idade, da cidade e do tipo de plano. Com essas respostas, o corretor já te manda as opções com preço certinho." |
| FAQ operadoras (`quick-reply.ts:293`) | `Trabalhamos com as principais operadoras da região. O corretor vai te mostrar as que melhor atendem o seu perfil.` | **A:** "Trabalhamos com as principais operadoras da região, e a gente escolhe com você as que combinam com o seu perfil." |
| FAQ carência (`quick-reply.ts:294`) | `As carências variam por operadora e por plano, e em alguns casos dá para reduzir. O corretor te explica certinho junto com as opções.` | **A:** "Cada operadora tem suas carências, que variam por plano, e em alguns casos dá pra reduzir. O corretor te explica tudo com calma junto com as opções." |
| FAQ "quem é" / "é robô" (`quick-reply.ts:295`) | `Sou a assistente virtual da corretora e estou preparando seu atendimento para um corretor especialista.` | **A:** "Sou a {assistente}, assistente virtual da {empresa}. Estou organizando seu atendimento pra um corretor especialista te atender." (Manter a transparência de que é automático.) |
| Situação custom do diretor (`attendance-situations/catalog.ts:135-160`) | Texto escrito pelo diretor. | **Sem mudança.** Vale o texto do diretor (item 4.4). |
| Resposta lateral por LLM (`ai-agent/lateral-answer.ts`) | Até 2 frases curtas, com o contexto da corretora. Sanitizada (nada de preço, cobertura ou carência). | **Sem texto novo.** Só revisar as instruções do modelo para o mesmo tom do item 1. Testes de saída: sem travessão, sem promessa, até 2 frases. |

### Seção 8: Follow-up, reativação e requalificação de frios

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| Follow-up de abandono, regra desligada por padrão (`ai-qualification/followup-service.ts:151,178`) | `Olá! Ainda posso te ajudar a encontrar o melhor plano de saúde?` / `Olá! Ainda posso te ajudar com a cotação do seu plano?` | **A:** "{Bom dia\|Boa tarde\|Boa noite}, {nome}! Espero que esteja bem. Ainda posso te ajudar com a cotação do plano de saúde, se fizer sentido pra você?" **B:** "Oi, {nome}, tudo bem? Ainda posso cuidar da sua cotação de plano de saúde, sem compromisso." Regra continua desligada até aprovação. |
| Reativação de frio, template Meta (`cold-lead-reactivation-policy.ts:14-33`, `cold-lead-requalification.ts:314-324,468-473`) **[META]** | O corpo vive na Meta. Variáveis: [nome, "Assistente Ancora Saude", "Ancora Saude"]. | **A:** "Oi, {nome}, tudo bem? Aqui é da {empresa}. Você chegou a pedir uma cotação de plano de saúde com a gente. Se ainda fizer sentido, posso retomar de onde paramos, sem compromisso." Manter três variáveis, na mesma ordem. |
| Requalificação manual do diretor **[META]** (`cold-lead-requalification.ts:314-324`) | Mesmo template da linha de cima. Placeholder interno `Convite para retomar a qualificação.` (`cold-lead-requalification.ts:202`). | Mesmo texto da reativação. O placeholder interno não vai ao cliente. |
| Timeout de qualificação (`ai-agent/qualification-timeout-sweep.ts:279-338`) | Não envia mensagem ao cliente. | **Sem mudança.** |

### Seção 9: Templates Meta da qualificação turbo

Todos estes são **[META]**. A proposta é o texto novo a cadastrar como versão nova do template (nome novo, ex.: `qualificacao_t0_v2`), para não quebrar o envio da versão aprovada. Templates da Meta são estáticos: não dá para variar o período do dia dentro do corpo, então a saudação usa "Oi". O período fica só nas mensagens de texto livre.

| Momento | Atual (arquivo:linha) | Proposta |
|---|---|---|
| T0, direta (`qualification-turbo/templates-pack.ts:38`) **[META]** | `Olá, {nome}. Recebemos seu pedido de cotação de plano de saúde na {empresa}. Para montar as opções certas, me conta: para quem é o plano?` | `Oi, {nome}, tudo bem? Aqui é da {empresa}. Recebemos seu pedido de cotação de plano de saúde, obrigado por chamar. Pra montar as opções certas, o plano é pra você, pra família ou pra empresa?` Botões iguais. |
| T0, canal (`templates-pack.ts:47`) **[META]** | `Olá, {nome}. Recebemos seu pedido de cotação de plano de saúde na {empresa}. Como prefere seguir com o atendimento?` | `Oi, {nome}, tudo bem? Recebemos seu pedido de cotação na {empresa}, obrigado. Como você prefere seguir?` Botões iguais. |
| T0, assistente se apresenta (`templates-pack.ts:56`) **[META]** | `Olá, {nome}, aqui é {nome_bot}, da {empresa}. Vou cuidar do seu pedido de cotação de plano de saúde. Para começar, para quem é o plano?` | `Oi, {nome}, aqui é {nome_bot}, da {empresa}. Espero que esteja bem. Vou cuidar do seu pedido de cotação. Pra começar, o plano é pra quem?` |
| T0, PME (`templates-pack.ts:65`) **[META]** | `Olá, {nome}. Recebemos o pedido de cotação de plano de saúde empresarial na {empresa}. Para montar a proposta, a empresa já tem CNPJ ativo?` | `Oi, {nome}, tudo bem? Recebemos seu pedido de cotação de plano empresarial na {empresa}, obrigado. Pra montar a proposta, a empresa já tem CNPJ ativo?` Botões iguais. |
| T0, operadora pedida (`templates-pack.ts:74`) **[META]** | `Olá, {nome}. Recebemos seu pedido de cotação do plano {operadora} na {empresa}. Para calcular, me conta: para quem é o plano?` | `Oi, {nome}, tudo bem? Recebemos seu pedido de cotação do plano {operadora} na {empresa}. Pra calcular certinho, o plano é pra quem?` |
| T0, madrugada (`templates-pack.ts:83`) **[META]** | `Olá, {nome}. Recebemos seu pedido de cotação de plano de saúde na {empresa}. Quando puder, me conta para quem é o plano e eu já deixo as opções prontas.` | `Oi, {nome}. Recebemos seu pedido de cotação na {empresa}, obrigado por chamar. Quando puder, me conta pra quem é o plano que eu já deixo as opções prontas.` |
| T1, lembrete +20 min (`templates-pack.ts:92`, UTILITY) **[META]** | `Oi, {nome}. Seu pedido de cotação de plano de saúde continua aberto aqui na {empresa}. Falta só saber para quem é o plano.` | `Oi, {nome}, tudo bem? Seu pedido de cotação continua aberto aqui na {empresa}. Falta só saber pra quem é o plano, quando você puder.` |
| T2, reengajamento +3 h (`templates-pack.ts:101`, MARKETING) **[META]** | `Oi, {nome}. Consigo comparar as principais operadoras para você e mostrar as opções que cabem no seu bolso, com a rede de hospitais de cada uma. Quer que eu prepare?` | `Oi, {nome}. Posso comparar as principais operadoras pra você e mostrar as opções que cabem no seu bolso, com a rede de hospitais de cada uma. Quer que eu prepare?` |
| T3, ligação, manhã seguinte (`templates-pack.ts:110`, MARKETING) **[META]** | `Oi, {nome}. Se for mais fácil, um especialista da {empresa} pode te ligar e explicar as opções de plano de saúde em poucos minutos. Prefere assim?` | `Oi, {nome}. Se for mais fácil, um especialista da {empresa} pode te ligar e explicar as opções em poucos minutos, sem compromisso. Prefere assim?` |
| T4, despedida +3 dias (`templates-pack.ts:119`, MARKETING) **[META]** | `Oi, {nome}. Não quero te incomodar. Posso encerrar seu pedido de cotação de plano de saúde ou ainda quer receber as opções?` | `Oi, {nome}. Não quero te incomodar. Você quer continuar recebendo as opções, ou prefere que eu encerre seu pedido?` Botões `Quero receber` / `Pode encerrar` mantidos. |
| Reativação de lead antigo (`templates-pack.ts:128`) **[META]** | `Oi, {nome}. Há alguns dias você pediu uma cotação de plano de saúde na {empresa}. Ainda está procurando? Posso te mandar as opções atualizadas.` | `Oi, {nome}, tudo bem? Há alguns dias você pediu uma cotação de plano de saúde na {empresa}. Ainda está procurando? Se sim, posso mandar as opções atualizadas, sem compromisso.` |
| Cadência T1 a T4 (`qualification-turbo/cadence.ts:23-27`) | Só timings. | **Sem mudança.** |

---

## 4. Regras de engenharia

### 4.1 Continua determinístico
- O roteiro (o que perguntar e quando concluir) continua no motor. O texto (como dizer) continua em `reply-composer.ts` e em listas de variantes. Nada de LLM no roteiro.
- Única exceção já existente: a objeção por modelo (`qualification-interpreter.ts`). Ela muda só a instrução (seção 5), e a saída continua passando pelo filtro de travessão e pelo filtro de promessa.
- Saudação por período vem de uma função pura `greetingForHour(date)` com `Intl` em America/Sao_Paulo, no mesmo estilo de `isAfterHoursInSaoPaulo` (`reply-composer.ts`). Teste com 04h59, 05h00, 11h59, 12h00, 17h59, 18h00, 23h59 e 00h00.

### 4.2 Palavras-chave e `wasQuestionAsked`
- `wasQuestionAsked` (`reply-composer.ts`, função exportada) compara o texto enviado com as variantes e com o legado, por inclusão. Se a pergunta nova for trocada sem manter a antiga, o motor perde a noção de "já perguntei" e repete. **Ação:** manter uma lista `LEGACY_QUESTION_TEXTS` com todas as versões antigas de cada pergunta, e somá-la aos needles.
- Prefixos e frases de porquê entram no mesmo texto enviado. Como `lastQuestionAsked` guarda a mensagem inteira (`conversation-state-machine.ts:964`), o extrator de cidade e bairro (`memory.ts:446-457`, que procura "cidade" e "bairro" em `lastQuestionAsked`) continua funcionando, desde que as palavras estejam no texto. **Ação:** teste de regressão com respostas curtas ("Niterói, Icaraí", "35 e 32", "individual", "não tenho") contra as novas perguntas.
- Palavras obrigatórias por pergunta (lista do inventário, item 3): `nome`, `cidade`, `bairro`, `plano de saúde hoje` (o marcador é `CURRENT_PLAN_MARKER`, em `memory.ts:136`, sem acento), `quantas pessoas`/`vidas`, `idade`/`quantos anos`, `e-mail`, e `individual|familiar|empresarial|empresa|CNPJ|MEI|PME|PF|PJ`.
- As definições de `qualification-engine/service.ts:80-130` ficam como estão. Elas são needles e não vão ao cliente.

### 4.3 Anti-repetição
- Hoje o código olha só a `previousReply`. **Ação:** trocar por `recentReplies` (últimas 3 mensagens enviadas). A abertura de uma mensagem nova não pode repetir a primeira palavra de nenhuma das 3 (já existe `firstWord`, só estende).
- Saudação por período: só uma vez por conversa. Usar uma marca no estado da conversa (`greeted: true`) ou detectar saudação nas mensagens enviadas, para não repetir.
- Nome: não repetir em duas mensagens seguidas (regra atual).
- Seed: a escolha continua por `pick(variants, seed)`. A mesma seed dá o mesmo texto, então uma retentativa mantém a redação.

### 4.4 Precedência do diretor
- `customText` (Atendimento > Fluxo, `questionTexts`) continua vencendo as variantes internas (`reply-composer.ts`, `composeQuestionReply`). **Decisão aberta (D1):** o `customText` recebe a saudação de período e o agradecimento automáticos, ou sai exatamente como o diretor escreveu? Recomendação: sai como escrito. O diretor escolheu o texto, e o sistema não deve reescrevê-lo.
- Textos de quick reply e situações (`quick-reply.ts:320-328`, `attendance-situations/catalog.ts`) também valem sobre o padrão.
- Tenants que já salvaram um texto padrão antigo (ex.: `ai_quick_reply_templates`) continuam com o texto antigo. **Ação:** ver item 4.5 e avisar o diretor na tela de Situações ("restaurar padrão").

### 4.5 Textos aposentados
- Todo texto padrão trocado entra na lista de aposentados do seu módulo, para que tenants sem personalização recebam o novo:
  - `RETIRED_HANDOFF_TEXTS` (`reply-composer.ts:300-303`)
  - `RETIRED_DEFAULT_BODIES` (`quick-reply.ts:312-318`)
  - Encerramento: hoje o `finalMessage` de `closing-state-service.ts:81-88` não tem lista de aposentados. **Ação:** criar a lista lá também, senão o padrão antigo salvo volta a sair.
- Texto que o diretor escreveu nunca é aposentado.

### 4.6 Botões e opt-out
- Os botões dos templates turbo ("Quero receber", "Pode encerrar", "Agora não", "Prefiro ligação", "Só para mim" etc.) não mudam de texto nesta rodada. Eles são casados por regex em `quick-reply.ts:155-167` (`parseOptOut`, `parseStartQualification`). Se um botão mudar de nome na Meta sem atualizar a regex, o opt-out para de funcionar, o que é um problema de LGPD.
- Se algum botão precisar mudar, a regex e o texto novo do botão entram no mesmo deploy, com teste.

### 4.7 Templates Meta
- Cada template alterado vira uma **versão nova** com nome novo. A versão antiga continua ativa até a nova ser aprovada e o envio migrar.
- O código de envio (`cadence.ts`, `outbound-service.ts`) escolhe o template pelo nome. A troca de nome é a única mudança de código nesse ponto.
- Variáveis: manter o número e a ordem de placeholders de cada template.

### 4.8 Testes
- Teste de propriedade sobre **todas** as variantes: nenhum travessão, nenhum emoji no corpo de template, no máximo 3 frases, no máximo 1 pergunta.
- Teste de palavras-chave: cada pergunta nova contém a palavra-chave do extrator.
- Teste de `wasQuestionAsked`: uma pergunta antiga (legado) enviada antes do deploy ainda é reconhecida.
- Teste de anti-repetição: sequência de 4 respostas não repete a abertura nem o nome em mensagens seguidas.
- Teste de período: os horários de borda do item 4.1.
- Arquivos: `reply-composer.test.ts`, `after-hours.test.ts`, `service.test.ts` (já existem em `src/features/qualification-engine/`). Novos: `humanized-copy.test.ts`.
- Só testes focados, type-check e eslint, como nas outras entregas do time. Nenhum teste de banco.

---

## 5. Fases de implementação

Cada fase é um commit ou um lote pequeno. Quem faz cada fase é decidido pelo Maestro. Deploy é do Vinicios.

| Fase | O que entra | Arquivos principais | Testes | Pré-requisito |
|---|---|---|---|---|
| **F0. Decisões** | Aprovar o tom (item 1), decidir D1 (customText) e D2 (período de silêncio para repetir a saudação, proposta 6 h), validar os textos de privacidade (risco 4). | Este documento. | Não aplica. | Nenhum. |
| **F1. Base** | `greetingForHour`, `recentReplies` (3 mensagens), `LEGACY_QUESTION_TEXTS`, marca de saudação na conversa, teste de propriedade de todas as variantes. Sem mudar textos ainda. | `reply-composer.ts`, `reply-composer.test.ts`, `humanized-copy.test.ts` (novo). | Testes de propriedade e de anti-repetição. Comportamento de hoje inalterado (mesmos textos). | F0 |
| **F2. Perguntas e confirmações** | Seções 2 e 3 (nome, plano, vidas, idade, cidade, e-mail, acks, resumo, plano atual, lead-in e prefixo de última pergunta). | `reply-composer.ts` (`questionVariants`, `fieldAcks`, `currentPlanQuestion`). | Teste de regressão do extrator com respostas curtas; `service.test.ts` com os fluxos completos. | F1 |
| **F3. Handoff, encerramento e quick replies** | Seções 4 e 7, incluindo `RETIRED_*` e a lista nova do encerramento. | `reply-composer.ts`, `closing-state-service.ts:87-88,152`, `quick-reply.ts:286-303,312-318`. | Testes de regex de opt-out (`quick-reply.ts:155-167`) e de textos aposentados. | F1 |
| **F4. Objeção e guardrails** | Seções 5 e 6, instrução do modelo de objeção, fallbacks e legado. | `qualification-interpreter.ts:34-39,120`, `conversation-state-machine.ts:1146,1167-1168,1863`, `fallback-response.ts`, `ai-response-schema.ts:151-176`. | Testes de saída do modelo (sem preço, sem promessa, sem travessão) com respostas gravadas. | F1 |
| **F5. Templates Meta** | Seções 1 (fallback), 8 e 9. Cadastro das versões novas na Meta, depois troca de nome no código. | `templates-pack.ts`, `outbound-service.ts:754`, `cold-lead-requalification.ts`, `cold-lead-reactivation-policy.ts`. | Teste de nome de template e de número de variáveis. | F0 e aprovação na Meta |
| **F6. Medição** | Registrar a chave da pergunta enviada (`questionKey`) além do texto. Painel de métricas do item 6. | `reply-composer.ts`, `conversation-state-machine.ts:964`, relatório de qualificação. | Teste do registro. | F1 |

Ordem sugerida: F0, F1, F6 (para ter a linha de base), depois F2 e F3 juntas, F4, e F5 em paralelo com a aprovação da Meta.

---

## 6. Como medir

**Linha de base:** 7 dias antes do deploy de F2. Não comparar dias úteis com fim de semana. Usar dias da semana equivalentes.

**Métricas principais**
- **Taxa de resposta por pergunta:** conversas em que o lead respondeu ao campo perguntado nas próximas 24 h, dividido pelas perguntas enviadas daquela chave (`questionKey`). Medir por campo: nome, plano, vidas, idade, cidade, e-mail.
- **Qualificação completa (%):** conversas com os campos obrigatórios preenchidos, dividido pelas conversas iniciadas.

**Contrapesos (para não ganhar em uma e perder na outra)**
- **Número de mensagens até completar:** se subir muito, a mensagem está longa demais.
- **Taxa de opt-out:** deve ficar igual ou menor. Se subir, a mensagem está incomodando.
- **Taxa de handoff pedido pelo lead:** se subir, o lead não confiou no fluxo.
- **Tempo até a primeira resposta do lead:** tendência, sem meta.

**Comparação**
- Antes e depois: 7 dias de cada lado, com o mesmo volume mínimo de conversas. Registrar a data do deploy.
- Se possível, separar um grupo de controle por paridade do hash da conversa (mesma seed, mesmo texto antigo) no tenant piloto. Assim o efeito da humanização fica separado de mudanças de campanha, de sazonalidade e de templates da Meta.
- Anotar mudanças de campanha, de template e de horário de corretor durante a janela. Sem isso, o número não significa nada.

**Limite:** com volume baixo, a variação de uma semana para outra é grande. Antes de decidir, conferir o tamanho da amostra por pergunta.

---

## 7. Riscos

1. **Mensagem longa reduz a resposta.** O objetivo é acolher, mas uma mensagem de 4 frases pode cansar. Limite de 3 frases e 1 pergunta, e medir o contrapeso de mensagens até completar.
2. **Saudação repetida soa robótica.** Por isso a saudação de período só aparece na abertura e depois de silêncio (item 2). Se o lead reclamar de "Bom dia" repetido, a regra vale mais que o texto.
3. **Extrator quebrado por texto novo.** Frases de porquê e prefixos podem tirar a palavra-chave do lugar errado, ou fazer `lastQuestionAsked` ficar ambíguo. Coberto por teste de regressão (item 4.2).
4. **Promessas de segurança sem base.** "Os dados ficam só com a corretora", "não enviamos spam", "não compartilhamos" e "pode apagar" precisam de confirmação do jurídico e da política de privacidade. Sem isso, são promessas falsas, e a segurança vira o problema. **Enquanto não confirmar, esses trechos ficam fora dos textos**, e a versão usa só o que é verdade (ex.: "Assim eu já cotou o valor certinho").
5. **"Um corretor continua por aqui" precisa ser verdade.** Fora do horário, o texto diz "assim que a equipe começar", sem prometer horário fixo. Domingos e feriados: confirmar com o Vinicios se a equipe atende nesses dias antes de fixar qualquer horário.
6. **Texto livre fora da janela de 24 h não pode ser enviado** pelo WhatsApp. O fallback de `outbound-service.ts:754` só vale dentro da janela. Fora dela, a abertura tem que ser template aprovado.
7. **Templates Meta.** Reaprovação pode demorar ou ser rejeitada. Mudança de texto pode trocar a categoria (UTILITY para MARKETING), o que muda custo e entrega. Mais denúncias derrubam a qualidade do número. Versão nova sempre com nome novo (item 4.7).
8. **Opt-out e regex de botões.** Trocar um botão sem a regex quebra o opt-out (item 4.6). É o risco mais caro, porque é LGPD.
9. **Tenants com texto salvo.** Quem personalizou continua com o texto antigo, e isso é o esperado. Quem não personalizou precisa dos aposentados (item 4.5), senão recebe o texto velho para sempre.
10. **Horário.** O servidor roda em UTC. Se a saudação usar o horário do servidor, a "boa noite" sai às 21h em São Paulo. Sempre `America/Sao_Paulo` (item 4.1).
11. **Objeção por modelo.** Uma instrução mais calorosa pode fazer o modelo prometer mais. Testes de saída com respostas gravadas (item 4.8) e a regra de não prometer preço continuam.
12. **Custom do diretor.** Se a saudação automática for aplicada ao `customText`, o diretor perde o controle do texto dele. Recomendação: não aplicar (D1).
13. **Sensação de "bot disfarçado".** Saudações afetuosas podem dar a impressão de atendente humano. A transparência do FAQ "quem é" e a frase "sou a assistente virtual" continuam, por honestidade e para não ferir a segurança do lead.

---

## 8. Decisões abertas para o Vinicios

**Decidido pelo Vinicios em 26/10 ("pode seguir com as recomendações"):**
- D1: o `customText` do diretor sai exatamente como escrito.
- D2 e D6: a saudação de período volta depois de 6 horas de silêncio.
- D3: sem resposta jurídica. Fica valendo o risco 4: nenhuma promessa de privacidade (nada de "seus dados ficam só com a corretora"). A segurança vem de explicar por que cada dado é pedido e de dizer que um corretor de verdade continua.
- D4: a equipe atende de segunda a sábado; domingo NÃO. Mensagem fora do horário no sábado à noite e no domingo diz que o corretor retorna na segunda, a partir das 9h, sem prometer minutos. Feriados nacionais (fixos e Sexta-feira Santa): não atende, como domingo, com a frase do próximo dia útil. Carnaval e Corpus Christi: dia normal, a equipe atende (confirmado pelo Vinicios, 26/10).
- D5: o emoji 👋 sai.
- D7: o parentesco vai como convite opcional na mensagem de encerramento.

Lista original:

- **D1.** O `customText` do diretor recebe saudação e agradecimento automáticos, ou sai exatamente como escrito? Recomendação: sai como escrito.
- **D2.** Depois de quantas horas de silêncio a saudação de período volta? Proposta: 6 horas.
- **D3.** Quais frases de privacidade podemos usar (item 4 risco 4)? Pedir confirmação jurídica.
- **D4.** A equipe atende domingo e feriado? Isso define o texto fora do horário (risco 5).
- **D5.** O emoji "👋" do fallback de `outbound-service.ts:754` sai de vez? Recomendação: sai.
- **D6.** A regra de repetição de saudação usa 6 horas de silêncio, ou outro valor?
- **D7.** Parentesco (seção 9): a pergunta vai na mensagem de encerramento, como convite opcional (recomendado), ou em mensagem separada antes do encerramento?

---

## 9. Acréscimo: parentesco de cada idade

Pedido do Vinicios (26/10): quando o lead manda várias idades, o bot pergunta quem é cada pessoa (ex.: "46 e 10" → "E quem são? Você e seu filho(a)?"), para o corretor saber quem são as pessoas. Esta seção só planeja. Nada foi implementado.

### 9.1 Quando perguntar
- **Gatilho:** `memory.age` tem **2 ou mais idades** (a mesma leitura que `ages()` em `reply-composer.ts` já faz), e o plano é **individual ou familiar**. Empresarial não entra: lá a pergunta é a média de idade, e o corretor não precisa de parentesco.
- **Não perguntar** se o parentesco já foi informado (`beneficiaries` preenchido) ou se a pergunta já foi feita nesta conversa (flag `relationAsked`).
- **Não perguntar** com uma idade só. Nesse caso a pessoa que fala é, na prática, a titular.
- **Momento:** depois que os campos obrigatórios estiverem completos (nome, plano, vidas, idades, cidade, e-mail), na mensagem de encerramento. Motivo: não atrasa a qualificação nem a distribuição, e o lead já está engajado. A pergunta aparece como convite, não como bloqueio.
- Se o lead não quiser ou ignorar, o encerramento segue normal.

### 9.2 Texto da pergunta (opcional, acolhedor)

Usar só a última frase da mensagem de encerramento, depois do resumo. Sempre com a saída "se preferir, pode deixar pra lá".

- **A:** "Se quiser, me conta quem são essas pessoas, por exemplo: você e seu filho. Assim o corretor já chega sabendo. Se preferir, pode deixar pra lá, sem problema."
- **B:** "Pra o corretor já chegar sabendo quem é quem, me diz o parentesco de cada uma? Por exemplo: 46 é você e 10 é seu filho. Se preferir não falar, tudo bem."
- **C:** "Só mais uma coisa, se quiser: quem é cada uma dessas pessoas? Pode responder do jeito que for mais fácil. Se não quiser, a gente segue normalmente."

Regras do texto:
- Não pedir nome de dependente, só parentesco e idade (LGPD e minimização).
- Sem "E quem são?" seco, sem exigir resposta.
- Uma variante por conversa, escolhida por `pick(…, seed)`, com anti-repetição do item 4.3.
- Não usar "sócios", "vidas" ou "empresa" nesta pergunta (é plano pessoal ou familiar).

### 9.3 Como extrair
Vocabulário de parentesco, normalizado (sem acento, minúsculo), em 6 valores fixos:

| Valor | Palavras que disparam |
|---|---|
| `titular` | "eu", "eu mesmo", "sou eu", "é você", "você" (quando o lead fala de si) |
| `conjuge` | "esposa", "marido", "mulher", "companheiro", "companheira", "cônjuge", "namorado(a)" (namorado entra como `outro` se o plano for individual) |
| `filho` | "filho", "filha", "filhos", "filhas", "enteado", "enteada" |
| `pai_mae` | "pai", "mãe", "mae", "pais", "sogro", "sogra" |
| `neto` | "neto", "neta", "netos", "netas" |
| `outro` | "irmão", "irmã", "sobrinho", "tio", "tia", "primo", "amigo", e qualquer outro termo. Guardar o texto original. |

Ligação com cada idade:
1. **Por número:** se a resposta cita a idade junto do parentesco ("46 é você, 10 é meu filho"), ligar pelo número. É o caso mais seguro.
2. **Por ordem:** se a resposta não cita números, mas a quantidade de parentescos é igual à de idades, ligar na ordem em que o lead falou ("eu e meu filho" com as idades "46 e 10" → titular 46, filho 10). Só vale se a ordem da resposta for a mesma da lista de idades, que vem na ordem em que o lead escreveu.
3. **Sem ligação segura:** se nenhuma das duas regras fecha, **não adivinhar**. Guardar o texto bruto em `beneficiaryRaw` e marcar a pessoa como "parentesco não confirmado". O corretor vê o texto, sem um rótulo errado.

Regras de segurança do parser:
- Resposta sem nenhum parentesco ("não", "pode seguir", "prefiro não falar") → não gera nada, e a flag `relationAsked` fica `true`.
- "Filho" dentro de uma frase sobre outra coisa ("meu filho ainda não tem plano") não deve virar parentesco. Por isso o parser exige que a palavra esteja ligada a uma idade ou a um pronome, e o teste cobre esse caso.
- Um lead que diz "a família toda" sem números → não mapeia.

### 9.4 Onde guardar

**Memória da conversa** (`src/features/ai-agent/memory.ts`, tipo `ConversationMemory`):
- Novo campo `beneficiaries?: Array<{ age: number; relation: "titular" | "conjuge" | "filho" | "pai_mae" | "neto" | "outro" | null; relationText?: string; sourceMessageId?: string }>`. Mantém a ordem das idades.
- Novo campo `relationAsked?: boolean`, para não repetir a pergunta.
- O campo antigo `beneficiaryRelation` (texto livre de "filha", "pai") continua lendo, para não quebrar conversas em andamento. Migrar na leitura: se `beneficiaries` estiver vazio e `beneficiaryRelation` existir, usar como `outro` com o texto original.
- `collectedFields` **não** recebe `relation`. Parentesco é opcional e não pode entrar no cálculo de qualificação completa.

**Lead** (`leads.qualification_details`, jsonb): chave nova `beneficiarios`, lista de `{ idade, parentesco, texto }`. Sem migração de banco, porque a coluna já é jsonb. Gravada junto com `resumoAtendimento`, no mesmo ponto onde o motor grava os outros detalhes (localizar no `qualification-engine/service.ts` antes de implementar).

### 9.5 Onde o corretor vê

**1. Ficha do lead** (`src/app/(dashboard)/leads/[id]/page.tsx`): perto de `livesCount` (linha ~280), mostrar "Pessoas no plano: você (46), filho (10)". Quando não confirmado: "Idades: 46 e 10 (parentesco não informado)". Ler a chave com o mesmo `read(…)` de `readQualificationDetails` (linha ~1068).

**2. Resumo do handoff** (`reply-composer.ts`, `summarizeQualification`): acrescentar o parentesco ao resumo que vai para `{resumo}`, em formato curto:
- com parentesco: "familiar, você 46 e filho 10 anos"
- sem parentesco: "familiar, 2 pessoas, 46 e 10 anos" (como hoje)
- Os nomes de dependentes nunca entram no resumo.

**3. Resumo persistido** (`resumoAtendimento`): o mesmo texto, para aparecer na lista e nas notas.

Não mexer na listagem de leads (`leads/page.tsx:162`), que seleciona um subconjunto de chaves de `qualification_details`. Se o corretor precisar ver isso na lista, adicionar a chave ali como tarefa separada.

### 9.6 Testes
- **Parser** (`humanized-copy.test.ts` ou arquivo novo `relationship-parser.test.ts`):
  - "46 e 10" com "eu e meu filho" → titular 46, filho 10 (por ordem)
  - "você 46, filho 10" → por número
  - "minha esposa e eu" com 2 idades → conjuge e titular
  - "35 e 32" com "filhos" apenas → nenhum mapeamento seguro, texto bruto guardado
  - "meu filho ainda não tem plano" → nenhum parentesco
  - "prefiro não falar", "pode seguir" → nenhum parentesco, flag `relationAsked` ligada
  - "neto", "sogra", "irmão" → valores certos, `irmão` como `outro` com texto
- **Gatilho:** 1 idade não pergunta; 2+ idades em individual pergunta; 2+ em empresarial não pergunta; já respondido não pergunta de novo; pergunta feita uma vez.
- **Não bloqueante:** a qualificação completa e o handoff saem sem o parentesco. Teste em `service.test.ts` com o fluxo sem a resposta.
- **Captura depois do encerramento:** se o lead responde o convite depois do encerramento, o estado "encerrado" (`closing-state-service.ts:152`) grava o parentesco e não manda a mensagem genérica de novo. Teste do caminho.
- **Persistência:** `qualification_details.beneficiarios` gravado com idade e parentesco; leitura legada com `beneficiaryRelation` continua funcionando.
- **Resumo:** `summarizeQualification` com e sem parentesco; nenhum nome de dependente no texto.
- **Ficha:** renderização com parentesco confirmado, parcial e ausente.
- **Texto:** nenhum travessão nas variantes do convite; as 3 variantes são distintas.

### 9.7 Fases (entram no plano de implementação)
- **F7.** Parser e memória (`memory.ts`, parser novo, testes de parser). Depende de F1.
- **F8.** Convite no encerramento e captura depois do encerramento (`reply-composer.ts`, `closing-state-service.ts`). Depende de F3 e F7.
- **F9.** Resumo do handoff e persistência em `qualification_details` (`reply-composer.ts`, `qualification-engine/service.ts`). Depende de F7.
- **F10.** Ficha do lead (`leads/[id]/page.tsx`). Depende de F9.

Cada fase é um lote pequeno, com teste focado, type-check e eslint. Nenhum teste de banco.

### 9.8 Riscos
1. **Mapeamento errado é pior que nenhum.** Um rótulo trocado ("filho 46") confunde o corretor e pode gerar uma proposta errada. Por isso o parser não adivinha (item 9.3).
2. **Convite visto como invasão.** Pedir a relação de cada pessoa pode soar como interrogatório. Mitigação: o convite é opcional, uma vez por conversa, e a saída "pode deixar pra lá" fica explícita.
3. **Dados de menores.** A idade de um filho é dado pessoal. Coletar só parentesco e idade, sem nome, e explicar o motivo no texto (o corretor precisa saber quem é quem).
4. **Falso positivo do parser.** "Filho" em outra frase virar parentesco. Coberto pelo teste de 9.6.
5. **Resposta depois do encerramento.** Se o estado de encerramento não capturar, o lead responde e o corretor não vê. Coberto pelo teste de captura.
6. **Ficha com chave nova.** Listagens que copiam `qualification_details` por chave (`leads/page.tsx:162`) não mostram o campo novo. Aceito por ora, documentado no item 9.5.
7. **Resumo mais longo.** Com parentesco, o `{resumo}` cresce. Testar se cabe no texto de handoff sem quebrar a frase.

### 9.9 Medição
- Taxa de resposta ao convite (quantas conversas com 2+ idades respondem o parentesco).
- Taxa de parentesco mapeado com segurança (sem "não confirmado").
- Opt-out e handoff pedido pelo lead, comparados com o período sem o convite (item 6).
