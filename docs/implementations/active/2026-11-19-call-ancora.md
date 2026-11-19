# Call Âncora: discador automático próprio pelo celular

Briefing e registro de implementação do plano iniciado em 19/11/2026. O MVP visual está implementado; o discador Android, a base e a operação de contatos permanecem nas etapas seguintes. Este documento junta o que foi decidido, o que foi descartado e por quê, o que já existe no repositório e o que precisa ser levantado antes de avançar.

## 1. O problema e a ideia

Hoje a equipe da Âncora liga para contatos frios usando o **Calyx**, um discador comercial. O dono quer um discador **próprio**, usando a **base de frios da Âncora**, integrado ao CRM.

Como funcionaria na prática:

1. A Âncora entrega ao corretor um **celular Android com chip**, só para as ligações.
2. O corretor conecta esse celular à conta dele no sistema e usa **fone de ouvido**.
3. No **computador**, ele abre a tela "Sessão de ligações" e acompanha em tempo real a ligação ativa, o contato atual, o tempo de chamada e o próximo da fila.
4. O sistema manda o número; o **celular disca sozinho**.
5. Quando a ligação cai, o **celular avisa o sistema na hora**. O corretor marca o resultado, e a fila segue para o próximo número, numa lista contínua.
6. Se a pessoa tiver interesse, o corretor marca **"Tem interesse"**. O contato vira **lead na carteira desse corretor**, com origem "Call Âncora".

O ponto central é a **conexão entre três partes**: o sistema do corretor (web), o banco geral da Âncora (a base de frios) e o celular que faz as ligações.

## 2. Restrição do dono: não contratar nada novo

> "Eu não queria contratar mais nada, eu queria fazer uma operação só [...] sem contratar coisas novas, só o plano do celular mesmo."

Caminhos descartados:

| Caminho | Por que saiu |
|---|---|
| **VoIP** (ligação pelo computador, via tronco SIP, Twilio etc.) | Exige contratar uma operadora VoIP, que é a ponte entre a internet e a rede telefônica, e paga por minuto. Não há como ligar para número comum sem ela. |
| **Gateway GSM** (aparelho com chips que vira ponte VoIP no escritório) | É compra de equipamento e precisa de configuração. As operadoras costumam proibir esse uso em planos comuns e bloqueiam os chips. |
| **Só PWA** (o app web atual) | O navegador não liga sozinho nem lê o estado da ligação. O link `tel:` só abre o discador preenchido, e o corretor ainda precisa tocar em ligar. O PWA também não sabe quando a ligação acabou. |

## 3. Caminho escolhido

O **PWA atual dentro de uma casca nativa Android (Capacitor)**, com um **plugin nativo pequeno** que vira o **discador padrão** do aparelho.

- `RoleManager.ROLE_DIALER`: o app pede para ser o discador padrão. O aparelho é da Âncora, então isso é aceitável.
- `TelecomManager.placeCall(uri, extras)`: disca sem o corretor tocar na tela.
- `InCallService`: recebe os estados da ligação (`DIALING`, `RINGING`/`CONNECTING`, `ACTIVE`, `DISCONNECTED`, com `DisconnectCause`) e mostra a tela de chamada, que precisa existir, mesmo que mínima.
- Distribuição **fora da Play Store**: APK instalado direto ou via MDM. A Play Store restringe apps com permissão de ligação, mas o aparelho é corporativo.
- Custo: **só o plano do chip**. O número que aparece para o cliente é de celular, o que tende a aumentar o atendimento.

### Limitações já explicadas ao dono (não reabrir)

- **Sem gravação nem transcrição da ligação.** Desde o Android 10, um app de terceiros não acessa o áudio da chamada, nem sendo o discador padrão.
- **"Atendeu" nem sempre é exato.** Em algumas operadoras e redes, `ACTIVE` não diferencia bem "chamando" de "atendida". A **classificação do corretor é a palavra final**; a duração ajuda como pista.
- **Chip bloqueado ou marcado como spam.** Muitas ligações curtas seguidas podem fazer a operadora bloquear o chip ou o número aparecer como "possível golpe". É preciso **limitar o ritmo por chip** e ter chips de reserva.
- **Jurídico (pendência, não conclusão).** Validar antes de dar escala:
  - LGPD: de onde veio a base de frios, base legal e como tratar quem pede para sair;
  - regras da Anatel para telemarketing ativo: prefixo 0303 e bloqueio de chamadas de alto volume;
  - a lista **Não Me Perturbe**.

## 4. Arquitetura proposta

```
[Base de frios da Âncora] --fila/reserva--> [Backend AncoraHub (Next.js + Postgres)]
                                                |  WebSocket/SSE (estado ao vivo)
                       +------------------------+-------------------------+
                       |                                                  |
           [Tela web "Sessão de ligações"]                    [App Android (Capacitor + plugin discador)]
            (computador do corretor)                           (celular da Âncora, fone de ouvido)
```

### 4.1 Pareamento celular ↔ corretor
- Na tela web, "Conectar celular" mostra um **QR code** de uso único e curto, que o app lê.
- O app guarda um **token de dispositivo** ligado a tenant e corretor e pode ser revogado no sistema.
- Um celular por corretor por vez. Trocar de aparelho revoga o anterior.

### 4.2 Fila e reserva (backend)
- Uma **campanha** é um recorte da base de frios: origem, filtros, unidade.
- Ao pedir o próximo, o backend **reserva o número para aquele corretor**, com trava em transação (`for update skip locked` ou equivalente), para que dois corretores nunca liguem para o mesmo número. A reserva expira se não for usada.
- Regras da fila:
  - respeitar opt-out e números marcados "não ligar";
  - janela de horário permitida;
  - número de tentativas por contato;
  - intervalo mínimo entre tentativas.
- **Ritmo por chip**: limite de ligações por hora e por dia, com pausa automática.

### 4.3 Canal em tempo real
- O celular mantém uma conexão persistente (WebSocket) com o backend, e o **FCM** serve de reserva para acordar o app.
- A tela web recebe o estado ao vivo (discando, chamando, em ligação com cronômetro, encerrada), o contato atual e o próximo.
- Comandos da web para o celular: iniciar sessão, pausar, pular, encerrar ligação (se o plugin permitir) e terminar sessão.

### 4.4 Classificação e avanço
- Ao fim de cada ligação, a web mostra botões de um toque:
  - Não atendeu;
  - Caixa postal;
  - Sem interesse;
  - Ligar depois (agenda retorno);
  - Número errado (sai da base);
  - **Tem interesse**: cria o lead na carteira do corretor, com origem "Call Âncora", a nota da ligação e o retorno.
- Em seguida, uma **contagem curta (cerca de 3 s, com Pausar)** e o próximo número é discado.
- "Não atendeu" pode avançar sozinho pelo `DisconnectCause` e pela duração, com o corretor podendo corrigir.
- Tudo fica registrado: cada tentativa com início, fim, duração, causa e classificação, para relatórios e ranking.

## 5. O que já existe no repositório (levantar a fundo antes de codificar)

- **Stack**: Next.js App Router, Tailwind v4, Postgres com Drizzle (`src/shared/db/schema.ts`). Deploy **só no Coolify**, nunca Vercel. Jobs agendados entram em `docs/runbooks/coolify-scheduled-tasks.md`.
- **Base de frios**: não achei uma tabela "frios" dedicada. Pontos para investigar:
  - `brokerEligibilityProfiles.allowedLeadTypes` (`hot`/`warm`/`cold`);
  - importações: `src/features/leads/bulk-import.ts`, `src/features/marketing-import/`, e a lista da equipe do supervisor em `src/features/supervisor-workspace/lead-import/` (`SUPERVISOR_IMPORT_SOURCE = "supervisor_import"`).
  
  **Decidir se a base de frios é a tabela de leads (status próprio) ou uma tabela de contatos separada que só vira lead no "Tem interesse"**, que é a opção recomendada para não poluir o funil.
- **Criação de lead e carteira**: `src/features/leads/actions.ts`, `src/features/customers/broker-wallet-*`, `src/features/lead-distribution/`. Reaproveitar o caminho que já põe o lead na carteira do corretor, com escopo de tenant e de corretor.
- **Tempo real**: `src/features/notifications/realtime-sync.ts` (`publishDomainInvalidation`). Avaliar se serve ou se a sessão de ligações precisa de canal próprio.
- **App do corretor**: PWA no modo Lite (`src/components/light/`). Design system obrigatório:
  - `docs/design-system.md`;
  - feedback e movimento em `docs/design-system/FEEDBACK.md`: níveis 0 a 3, som e vibração só via `useFeedback`, respeitar `prefers-reduced-motion`.
- **Laboratório**: todo fluxo do corretor precisa ser testável em `/dev/laboratorio`, com telas reais e servidor simulado (`src/lib/dev-lab.tsx`, `useDevLab`). O Call Âncora deve ganhar um fluxo lá que simula o celular (estados de ligação falsos).
- **Direção do produto**: a Sasá, assistente do corretor, está virando agente que opera o CRM por voz (`docs/implementations/active/2026-11-19-sasa-agentica.md`). O Call Âncora deve conversar com isso no futuro, por exemplo "Sasá, começa minha sessão de ligações".

## 6. MVP em etapas (cada uma testável num celular real; o dono tem um aparelho)

1. **Prova do discador**: um app Android mínimo, só o plugin, sem integração. Vira discador padrão, liga para um número digitado e mostra na tela os estados recebidos. Medir, na operadora real, como `ACTIVE` se comporta.
2. **Casca Capacitor do PWA e pareamento**: o PWA atual dentro do app, com o QR code de pareamento e o token de dispositivo.
3. **Fila e sessão**:
   - campanha simples;
   - reserva com trava;
   - WebSocket entre celular e backend;
   - tela web "Sessão de ligações" com estado ao vivo;
   - classificação e avanço com contagem.
   
   Também um fluxo no laboratório.
4. **"Tem interesse" vira lead na carteira**, com nota e retorno; "Número errado" e opt-out saem da base.
5. **Ritmo e proteção do chip**: limites por hora e por dia, janela de horário, tentativas por contato, pausa automática.
6. **Gestão**: painel do gestor (ligações, atendidas, interessados por corretor), metas e ranking.

## 7. Decisões que ficam com o dono

1. Base de frios em tabela própria (recomendado) ou dentro de leads.
2. De onde vem a base: importação por planilha, lista do supervisor ou outra fonte.
3. Contagem antes do próximo número: 3 s (recomendado) ou manual.
4. "Não atendeu" avança sozinho (recomendado, com correção) ou sempre pede toque.
5. Limites de ritmo por chip (sugestão inicial: 60 por hora e 300 por dia, ajustar com a prova da etapa 1).
6. Quem vê o quê: o corretor só a própria sessão; o gestor da unidade e o diretor veem todas.
7. Validação jurídica antes de escalar (LGPD, Anatel, Não Me Perturbe).

## 8. Regras para o agente que for implementar

- Responder ao dono em **português do Brasil**. Quando houver opção recomendada, adotá-la e seguir.
- Trabalhar em **worktree e branch próprios**. A versão mais nova vive na branch `preview/3005`. Depois de cada commit:
  1. `git -C C:/Users/kyper/Desktop/Kyper/Projects/ancorahub merge --no-ff --no-edit <branch>`
  2. `git -C C:/Users/kyper/Desktop/Kyper/ancorahub-relatorio checkout --detach preview/3005`
- Nas pastas `ancorahub` e `ancorahub-relatorio`:
  - nunca use reset, rebase, stash ou `checkout -f`;
  - nunca mexa no `next.config.ts`;
  - nunca reinicie o servidor da porta 3005.
- Migrations: usar o número mais alto existente em qualquer branch do origin; cada entrada do journal precisa do seu `.sql`.
- Nunca imprimir segredos nem a URL do banco. Dados de teste fictícios.
- O app Android é um projeto novo: definir onde ele mora (sugestão: `apps/call-ancora-android/` no mesmo repositório, ou um repositório próprio) antes de começar a etapa 1.

## Registro de implementação: MVP visual

Status em 19/11/2026: demonstração visual entregue na branch `feat/call-ancora-mvp`.

- O corretor abre `/call-ancora` pelo menu Mais do Lite, inicia uma sessão e pareia o navegador do celular por QR de uso único, válido por dois minutos. O celular mostra a conta do corretor, o contato fictício, `Ligar` com `tel:` e `Simular` para avançar pelos estados. A tela do computador acompanha a ligação, o cronômetro, o próximo contato e a lista de interessados.
- O laboratório em `/dev/laboratorio` executa o mesmo fluxo com celular e estado simulados no navegador. Os 18 contatos têm números fictícios, inclusive o prefixo `00`; interesse não cria lead, não altera carteira e nenhuma chamada é iniciada pelo botão `Simular`.
- `src/features/call-ancora/session-store.ts` mantém estado apenas em memória do processo, por tenant e corretor, com sessão de quatro horas ociosas e pareamento de uso único. Não grava no banco e não persiste após reinício ou troca de processo. A interface consulta a sessão por polling a cada 1,2 segundo; não usa SSE.
- A rota exige sessão autenticada. A chave global `CALL_ANCORA_VISUAL` começa desligada; só libera corretores quando o Super-admin a ativa. Admins ativos da plataforma e desenvolvimento local podem validar a demonstração sem a flag, inclusive em "Ver como" com validação da sessão real do admin. A configuração é auditada pelo fluxo já existente. Sem migration e sem alteração de dados do CRM.
- Reutiliza Button Arc, tokens atuais, `LiteListPresence` e `useFeedback`; não cria token visual ou primitive. `prefers-reduced-motion` é respeitado pelo componente de presença compartilhado.
- Tsc, testes focados, build e eventuais limitações do harness serão registrados em `reports/agent/verification/call-ancora-mvp.md`.

### Fora deste MVP

Base de contatos, campanha, reservas concorrentes, logs de chamadas, criação de lead, integração em tempo real com o CRM, app Capacitor/Android, discagem automática, gestão, limites por chip e revisão jurídica continuam nas etapas posteriores do plano. O link `tel:` só abre o discador do aparelho; o MVP não consegue observar chamadas reais.
### Acesso e ativação

- A flag global `feature_call_ancora_visual_enabled` fica desligada por padrão (`false`).
- Corretores só veem e usam a demonstração quando o Super-admin ativa a flag.
- Admins ativos da plataforma e o ambiente local de desenvolvimento podem abrir a demonstração com a flag desligada; no modo "Ver como", o bypass é validado pela sessão real do admin.
- Sessões móveis de admin/desenvolvimento guardam o bypass apenas em memória, preso ao token temporário do aparelho. Para corretores, desligar a flag também bloqueia a API móvel.

### Ajustes de sessão em 19/11/2026

- A tela do celular encerra o polling ao receber HTTP 401 ou 403 e orienta gerar um novo QR. O mesmo tratamento vale para a simulação que receber esses status.
- A sessão do CRM usa a identidade autenticada como chave quando o admin está em `Ver como`, mantendo isolada a sessão do corretor visualizado. Tenant e permissões continuam vindo do contexto resolvido no servidor.
- Leituras do armazenamento em memória executam `prune()` para remover sessões ociosas e tickets antigos mesmo quando outra sessão é consultada.
- Evidência desta rodada: TypeScript, ESLint focado, quatro arquivos Vitest (20 testes) e build Webpack passaram. Relatório em `reports/agent/verification/call-ancora-mvp.md`; capturas em `reports/agent/call-ancora-mvp/`.
