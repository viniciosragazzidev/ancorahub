# CorreTop — System Design para Escala (Milhares de Corretores)

**Contexto:** o primeiro cliente vai ativar 5 unidades de uma corretora grande de forma concentrada, não gradual — e a ambição de longo prazo é milhares de corretores espalhados em várias corretoras. Este documento traduz isso em decisões técnicas concretas, priorizadas para um dev web (não especialista em infra) aplicar usando serviços gerenciados.

**Princípio-guia de todo este documento:** você não precisa virar especialista em infraestrutura — precisa escolher os serviços gerenciados certos e desenhar o código para usá-los corretamente desde o início. Trocar isso depois, com o sistema já em produção e com dados reais, é ordens de magnitude mais caro do que decidir agora.

---

## 1. Ajuste de Stack: Consolidar em Supabase

**Decisão:** usar **Supabase** (não Neon) como banco definitivo.

**Por quê:** com tempo real confirmado como requisito desde já, o Supabase resolve três necessidades com um único fornecedor gerenciado:
- **Banco Postgres** (o que já estava decidido)
- **Realtime** — o Postgres avisa a UI quando uma linha muda (novo lead, mudança de status, novo alerta de integridade), sem você construir servidor de socket nenhum
- **Storage** de documentos (já era uma opção considerada)

Isso substitui a necessidade de somar Pusher/Ably como um quarto serviço separado — menos contas, menos faturas, menos coisa pra monitorar sozinho.

**Onde usar Realtime na prática:** dashboards do Gestor/Diretor (fila de leads, alertas de integridade, contadores de meta) devem "assinar" mudanças nas tabelas relevantes (`leads`, `integrity_alerts`, `notifications`) via Supabase Realtime, em vez de polling. Para o corretor, a fila pessoal também se beneficia — ele vê o lead novo aparecer sem precisar recarregar a página.

---

## 2. Isolamento de Tenant em Duas Camadas (Row-Level Security)

**Decisão confirmada por você:** implementar RLS desde já, além do filtro de aplicação já planejado.

### Como funciona, de forma prática

1. Toda tabela que carrega `tenant_id` tem o RLS **habilitado** no Postgres (`ALTER TABLE leads ENABLE ROW LEVEL SECURITY`).
2. Cada tabela recebe uma **policy** que só libera linhas onde `tenant_id` bate com o tenant da sessão atual:
   ```sql
   CREATE POLICY tenant_isolation ON leads
   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
   ```
3. No início de cada requisição autenticada, seu backend define essa variável de sessão a partir do token do usuário logado, **antes** de qualquer query:
   ```typescript
   await db.execute(sql`SET LOCAL app.current_tenant_id = ${session.tenantId}`);
   ```
4. A partir daí, **mesmo que um desenvolvedor esqueça o filtro `WHERE tenant_id = ...`** numa query nova, o próprio Postgres bloqueia o acesso a linhas de outro tenant — é a segunda camada de proteção que você pediu.

### Onde isso entra no seu plano de desenvolvimento

- Deve ser feito **junto com a criação de cada tabela**, não como um retrofit depois — adicionar RLS depois que já existem centenas de queries escritas sem essa suposição é bem mais trabalhoso.
- Ajustar o helper central de acesso ao banco (já mencionado na Arquitetura de Desenvolvimento) para sempre abrir a transação definindo `app.current_tenant_id` antes de qualquer operação.

---

## 3. Processamento em Background (Filas com Inngest)

**Decisão confirmada por você:** usar um serviço gerenciado de filas — recomendo **Inngest** (tem plano gratuito generoso, integra nativamente com Next.js/Vercel via uma rota de API, e você escreve as funções como TypeScript normal, sem administrar fila nenhuma).

### O que migra para Inngest (em vez de rodar "na hora" da requisição)

| Processo | Por que não pode ser síncrono em escala |
|---|---|
| Verificação de SLA (não trabalhado / estagnado) | Não pode ser um loop varrendo todos os leads a cada X minutos — vira lento e caro conforme o volume cresce. Vira uma função Inngest agendada, com query em lote otimizada |
| Envio de mensagens WhatsApp | Se a API da Meta estiver lenta, isso não pode travar a resposta da tela pro corretor |
| Geração de PDF de cotação | Geração de PDF é relativamente pesada — não deve bloquear a resposta da Server Action |
| Cálculo de taxa de perda anormal (Painel de Integridade) | É um cálculo estatístico sobre todos os leads de um corretor — deve rodar em lote, periodicamente, não a cada clique |
| Reengajamento automático de leads perdidos | É naturalmente um job agendado (roda depois de X dias) |
| Geração do cronograma de comissão ao registrar venda | Pode continuar síncrono (é rápido), mas vale considerar mover para um evento assíncrono (`venda.criada` → Inngest gera o cronograma) se o cálculo crescer em complexidade |

### Benefício extra para o problema do "vizinho barulhento"

Como o processamento pesado sai da requisição principal e vai para filas, um pico de leads de uma corretora grande não trava a experiência das outras — as filas absorvem o pico e processam no próprio ritmo, sem derrubar a resposta do sistema pra ninguém.

---

## 4. Observabilidade Sólida Desde o Início

**Decisão confirmada por você:** investir nisso já, não esperar o problema aparecer.

### As três pernas da observabilidade

1. **Erros** — já decidido: Sentry.
2. **Logs estruturados** — em vez de `console.log` solto, adotar logs em formato estruturado (JSON, com `tenant_id`, `user_id`, `request_id` em todo log relevante) desde a primeira linha de código. Recomendo o **Axiom** (tem integração nativa com a Vercel, plano gratuito generoso, e é só configurar — sem servidor de log pra manter).
3. **Métricas** — acompanhar coisas como "tempo médio de resposta por rota", "quantidade de jobs Inngest falhando", "leads processados por minuto". A própria Vercel já entrega parte disso nativamente (Vercel Analytics/Observability); Axiom cobre o resto via os mesmos logs estruturados.

### Por que isso importa especialmente pro seu caso

Quando a corretora com 5 unidades ligar tudo de uma vez, e algo ficar lento, você precisa conseguir responder **"lento pra qual tenant, em qual rota, desde quando"** em minutos — não ficar adivinhando. Log estruturado com `tenant_id` em toda linha é o que torna isso possível.

---

## 5. Cadastro de Tenant: Manual E Self-Service, Desenhados Juntos

**Sua decisão:** poder fazer as duas coisas.

### Como desenhar isso sem duplicar lógica

Construa **uma única função central** de criação de tenant (`createTenant()`, uma Server Action ou função de domínio em `features/tenants/`), que:
- Cria o registro em `tenants`
- Cria a filial padrão
- Cria a assinatura (`subscriptions`)
- Dispara o e-mail/fluxo de boas-vindas

Essa função tem **duas "portas de entrada" diferentes**, mas a lógica de negócio é uma só:

1. **Porta manual (hoje):** o painel de super-admin chama `createTenant()` diretamente, como já especificamos.
2. **Porta self-service (quando fizer sentido):** um formulário público de cadastro + webhook de confirmação de pagamento do gateway de cobrança (Asaas/Stripe) chama a **mesma** `createTenant()` automaticamente, assim que o pagamento é confirmado.

**Por que isso importa agora:** se você escrever a lógica de criação de tenant "espalhada" dentro da tela do super-admin hoje, terá que reescrever tudo quando quiser abrir o self-service depois. Construindo como uma função central desde já, adicionar o self-service no futuro é só plugar uma nova porta de entrada — não uma refatoração.

---

## 6. Teste de Carga Antes do Lançamento das 5 Unidades

**Sua decisão:** rodar teste de carga antes do go-live.

### Ferramenta recomendada

**k6** (da Grafana) — você escreve o teste em JavaScript (familiar pra você), roda localmente ou via k6 Cloud (versão gerenciada, sem precisar manter infraestrutura de teste).

### O que testar, priorizado

1. **Distribuição de leads (round-robin)** — simular um burst de leads chegando simultaneamente via webhook, como aconteceria numa campanha das 5 unidades ao mesmo tempo.
2. **Carga no dashboard do Gestor/Diretor** — múltiplos usuários acessando ao mesmo tempo, já que são vários gestores olhando o painel de integridade e a fila da equipe.
3. **Mudança de status de lead concorrente** — múltiplos corretores atualizando leads ao mesmo tempo, testando se o RLS e as transações seguram bem sob concorrência.
4. **Webhook de captação de leads sob rajada** — simular uma campanha de anúncio gerando muitos leads em poucos minutos.

### Dimensionamento sugerido do teste

Como o primeiro grande cliente tem 5 unidades (e sua primeira corretora piloto já era "grande", 20+ corretores), uma estimativa razoável de pico é algo como **100-150 corretores simultâneos** entre as 5 unidades, mais os gestores/diretores. Vale simular esse volume com folga (ex: 2x) para ter margem de segurança.

---

## 7. Proteção Contra "Vizinho Barulhento" (Rate Limiting)

- O **webhook genérico de captação de leads** (por tenant, com token próprio) deve ter **rate limiting por tenant** — nenhuma corretora, por acidente ou campanha mal configurada, deve conseguir sobrecarregar o sistema para as demais.
- Recomendo **Upstash Ratelimit** (Redis gerenciado, serverless, sem servidor pra administrar) — encaixa no mesmo padrão de "tudo gerenciado" que você definiu.

---

## 8. Feature Flags (Antes que Você Precise Deles na Marra)

Com 5 unidades entrando ao vivo de uma vez e a ambição de crescer para milhares, **você não pode mais dar deploy de mudanças arriscadas para todo mundo de uma vez** — precisa poder ligar uma funcionalidade nova só para um tenant piloto antes de liberar geral.

**Recomendação leve para começar:** não precisa de uma ferramenta enterprise agora — uma tabela simples `tenant_features` (tenant_id, nome_da_feature, habilitado) já resolve o essencial. Se crescer muito, migrar para algo como Vercel Flags ou PostHog Feature Flags depois é uma troca incremental, não uma reescrita.

---

## 9. Priorização — O Que Aplicar Já vs. O Que Vem Depois

### Aplicar agora, antes do lançamento das 5 unidades

1. Consolidar em Supabase (banco + realtime + storage)
2. RLS em todas as tabelas com `tenant_id`, desde a primeira migration
3. Inngest configurado, com ao menos o motor de SLA e envio de WhatsApp já rodando como jobs, não código síncrono
4. Logs estruturados com `tenant_id`/`user_id`/`request_id` desde a primeira linha de código
5. Rate limiting no webhook de captação de leads
6. Função central `createTenant()`, mesmo que só a porta manual esteja ativa por enquanto
7. Teste de carga (k6) antes do go-live das 5 unidades

### Pode vir depois, sem prejuízo imediato

- Self-service de cadastro de tenant + integração de cobrança automática (a porta manual já resolve por agora)
- Ferramenta robusta de feature flags (a tabela simples resolve por enquanto)
- Métricas avançadas além de logs estruturados + Sentry + Vercel Analytics

---

## 10. O Que Isso Muda no Seu Plano de 7 Dias Original

O plano de 7 dias ainda é válido como sequência de **funcionalidades**, mas os itens de infraestrutura deste documento precisam entrar **junto com o Dia 1** (setup do projeto), não depois:

- Dia 1 ganha: setup do Supabase (não Neon), ativação de RLS desde a primeira migration, configuração inicial do Inngest e do Axiom.
- Todo item do plano original que envolve "motor" ou "job" (SLA, estagnação, reengajamento, cálculo de taxa de perda) passa a ser implementado como função Inngest, não como lógica síncrona solta.
- Antes do Dia 7 (go-live), inserir uma sessão de teste de carga com k6 contra o ambiente de staging.

---

*Este documento complementa o Documento de Requisitos, a Arquitetura de Desenvolvimento e o Plano de 7 Dias do CorreTop, endereçando especificamente a preparação para escala multi-tenant com alto volume.*
