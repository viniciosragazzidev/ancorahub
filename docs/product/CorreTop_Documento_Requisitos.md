# CorreTop — CRM para Corretoras de Planos de Saúde
## Análise de Negócio, Proposta e Documento de Requisitos

**Versão:** 1.0
**Data:** Julho/2026
**Autor do levantamento:** Claude (Anthropic) — baseado em entrevista com o desenvolvedor responsável

---

## 1. Resumo Executivo

O **CorreTop** é uma plataforma SaaS multi-tenant (B2B2B) destinada a corretoras de planos de saúde, com o objetivo de centralizar a gestão comercial e operacional do negócio: captação e distribuição de leads, cotação de planos, funil de vendas, gestão documental de clientes e cálculo automatizado de comissões/repasse para corretores.

O modelo de negócio é **assinatura mensal recorrente por corretora (tenant)**, com estrutura de planos por faixa (a ser definida com base em limites de usuários/volume). Cada corretora cliente acessa seu próprio ambiente isolado e gerencia internamente sua hierarquia de usuários (Diretor → Gestor → Corretor).

O projeto será desenvolvido **solo, em regime de dedicação intensiva (crunch)**, com stack moderna type-safe (Next.js, PostgreSQL, Drizzle, BetterAuth, Zod, TypeScript, Tailwind), hospedado em Vercel + banco gerenciado (Neon/Supabase).

---

## 2. Análise de Negócio

### 2.1 O mercado

Corretoras de planos de saúde no Brasil operam em um mercado com características bem definidas:

- **Múltiplas operadoras** (Amil, Bradesco Saúde, SulAmérica, Unimed, NotreDame Intermédica, Hapvida, etc.), cada uma com tabelas de preço, regras de carência e documentação próprias.
- **Comissão recorrente e escalonada**, não é um pagamento único — o corretor recebe uma comissão maior no primeiro mês e valores decrescentes nos meses seguintes (modelo confirmado pelo cliente: ex. 100% / 25% / 5%).
- **Ciclo de venda de médio prazo**, passando por cotação, negociação, análise documental e aprovação da operadora — múltiplos pontos de possível perda do lead.
- **Alta dependência de velocidade de resposta**: leads de planos de saúde esfriam rápido; corretoras que demoram a responder perdem a venda para concorrentes.
- **Dados de saúde são dados sensíveis** pela LGPD (art. 5º, II) — exige tratamento com cuidados redobrados de consentimento, controle de acesso e auditoria.

### 2.2 Validação da oportunidade

Já existem CRMs genéricos e alguns verticais para esse nicho no mercado brasileiro, o que indica que **a dor é real e validada**. O diferencial do CorreTop deve estar em:

1. **Especialização total no fluxo de planos de saúde** (não é um CRM genérico adaptado).
2. **Cotador com atualização semiautomática** (upload de tabelas + scraping complementar).
3. **Motor de comissão escalonada configurável**, que aparentemente é mal resolvido em soluções genéricas.
4. **SLA de leads com redistribuição automática**, reduzindo lead "esquecido" — um problema operacional crônico nesse mercado.

### 2.3 Riscos de negócio

| Risco | Impacto | Mitigação sugerida |
|---|---|---|
| Dependência de scraping de sites de operadoras (podem mudar estrutura ou bloquear acesso) | Alto | Sempre ter fallback manual; monitorar falhas e alertar equipe |
| Concorrência com CRMs já estabelecidos no nicho | Médio | Focar diferenciais (comissão escalonada, SLA, WhatsApp nativo) |
| Dados sensíveis de saúde — exposição a risco jurídico (LGPD) | Alto | Consentimento, criptografia, logs de auditoria desde o MVP |
| Prazo agressivo (crunch solo) pode comprometer qualidade/escopo | Alto | MVP realmente enxuto; cortar WhatsApp/scraping para fase 2 se necessário |
| Custo operacional do WhatsApp API (por conversa) pode não estar precificado na assinatura | Médio | Modelar custo por tenant e repassar ou limitar por plano |

---

## 3. Análise da Proposta

A proposta é **tecnicamente viável** com a stack escolhida, mas o **escopo declarado (para "módulos principais") já é, na prática, um sistema de porte médio-grande**: multi-tenancy, CRM de leads com SLA, cotador com scraping, gestão documental com aprovação, motor de comissão escalonado e integração completa de WhatsApp Business API.

**Recomendação central deste relatório:** dividir entre **MVP real** (o mínimo que já entrega valor e é vendável) e **Fase 2/3** (o que soma diferencial competitivo mas pode esperar). Isso está detalhado na Seção 8 (Roadmap).

Dado que o desenvolvimento é solo e em crunch, os módulos de **maior risco de estouro de prazo** são:
- Integração WhatsApp Business API (autenticação Meta, templates aprovados, webhooks de mensagem)
- Scraping automático de operadoras (manutenção contínua, alto custo de engenharia)

Ambos são valiosos, mas **não bloqueiam o primeiro cliente pagante** se o MVP tiver: cadastro manual de cotação (via upload de planilha/documento), botão de abertura de WhatsApp Web (sem histórico integrado) como versão intermediária.

---

## 4. Documento de Requisitos Funcionais (RF)

### 4.1 Módulo: Contas e Multi-tenancy

| ID | Requisito |
|---|---|
| RF001 | O sistema deve permitir o cadastro de uma nova corretora (tenant) mediante contato comercial/onboarding controlado pela equipe do CorreTop. |
| RF002 | Cada corretora deve ter seus dados completamente isolados de outras corretoras (isolamento lógico por `tenant_id`). |
| RF003 | O usuário "Diretor" (admin da corretora) deve poder criar, editar e desativar usuários Gestor e Corretor dentro do seu tenant. |
| RF004 | O sistema deve suportar 3 papéis fixos: **Diretor**, **Gestor**, **Corretor**, com permissões pré-definidas por papel. |
| RF005 | Diretor tem acesso total ao tenant; Gestor gerencia equipe e vê relatórios da sua equipe; Corretor vê apenas seus próprios leads/clientes. |
| RF006 | O sistema deve suportar assinatura mensal recorrente por tenant, com planos por faixa (a definir limites). |
| RF007 | Deve haver bloqueio de acesso automático em caso de inadimplência da assinatura (com tolerância configurável). |

### 4.2 Módulo: Captação e Gestão de Leads

| ID | Requisito |
|---|---|
| RF010 | O sistema deve permitir cadastro manual de leads (nome, telefone, e-mail, tipo de plano de interesse, origem). |
| RF011 | O sistema deve expor um webhook/API genérico por tenant (com token de autenticação próprio) para recebimento automático de leads de fontes externas. |
| RF012 | O sistema deve ter integrações prontas com pelo menos uma fonte de anúncios (ex: Meta/Facebook Lead Ads) na v1, com plano de expansão. |
| RF013 | Cada lead deve seguir um funil de status: Novo → Distribuído/Aguardando Contato → Em Atendimento → Cotação Enviada → Em Negociação → Documentação Pendente → Em Análise (Operadora) → Convertido / Perdido. |
| RF014 | Leads perdidos devem exigir motivo obrigatório de perda (ex: preço, concorrente, desistência, sem resposta). |
| RF015 | O sistema deve registrar todo o histórico de interações/atualizações de um lead (timeline). |

### 4.3 Módulo: Distribuição e SLA de Leads

| ID | Requisito |
|---|---|
| RF020 | Novos leads devem ser distribuídos automaticamente entre corretores disponíveis via round-robin. |
| RF021 | Um corretor é considerado "disponível" conforme critérios configuráveis (status ativo, dentro do limite de leads simultâneos definido pelo gestor). |
| RF022 | O sistema deve calcular SLA de lead com dois critérios configuráveis por tenant: (a) tempo máximo sem primeiro contato, (b) tempo máximo sem atualização/interação. |
| RF023 | Ao estourar o SLA, o lead deve ser marcado como "Não Trabalhado" e o sistema deve notificar o gestor e/ou redistribuir automaticamente (configurável). |
| RF024 | Deve existir uma fila/painel de "Retrabalho" para leads não trabalhados ou reabertos. |

### 4.4 Módulo: Cotador de Planos de Saúde

| ID | Requisito |
|---|---|
| RF030 | O sistema deve permitir upload de tabelas de preço/documentos de cotação por operadora, atualizáveis manualmente pelo Diretor/Gestor. |
| RF031 | O sistema deve ter um mecanismo de scraping configurável para atualização automática de tabelas públicas de operadoras, com fallback para atualização manual em caso de falha. |
| RF032 | O sistema deve alertar a equipe quando um scraper falhar ou uma tabela estiver desatualizada além de X dias. |
| RF033 | O corretor deve poder gerar uma cotação para um lead, selecionando operadora, plano e perfil dos beneficiários (idade, dependentes). |
| RF034 | A cotação gerada deve poder ser exportada/enviada (PDF ou link) ao cliente. |

### 4.5 Módulo: Gestão Documental

| ID | Requisito |
|---|---|
| RF040 | O sistema deve permitir configurar um checklist de documentos obrigatórios por tipo de plano/operadora. |
| RF041 | O corretor ou o próprio cliente (via link) deve poder fazer upload dos documentos exigidos. |
| RF042 | O gestor deve poder aprovar ou rejeitar cada documento enviado, com campo de observação em caso de rejeição. |
| RF043 | O lead/cliente só deve poder avançar para o estágio "Em Análise (Operadora)" quando todos os documentos obrigatórios estiverem aprovados. |
| RF044 | Documentos devem ser armazenados de forma segura (storage criptografado, acesso restrito por tenant). |

### 4.6 Módulo: Comissão e Repasse

| ID | Requisito |
|---|---|
| RF050 | O sistema deve permitir configurar regras de comissão por operadora/plano, com opção de comissão única (padrão) ou escalonada por período (ex: 100%/25%/5% nos meses 1, 2 e 3). |
| RF051 | Ao converter um lead em venda, o sistema deve gerar automaticamente o cronograma de repasse com base na regra de comissão aplicável. |
| RF052 | O sistema deve calcular e exibir, por corretor, o total de comissão prevista, paga e pendente. |
| RF053 | O Diretor/Gestor deve poder marcar comissões como "pagas" manualmente (não é objetivo do MVP integrar pagamento automático). |
| RF054 | O sistema deve gerar relatório de repasse por período (mês) para conferência e fechamento. |

### 4.7 Módulo: Comunicação (WhatsApp)

| ID | Requisito |
|---|---|
| RF060 | O sistema deve integrar-se diretamente à Meta Cloud API (WhatsApp Business, sem intermediário/BSP) para envio e recebimento de mensagens vinculadas a um lead, usando a conta Meta Business verificada da própria CorreTop. |
| RF061 | Deve haver uma caixa de entrada unificada por corretor, com histórico de conversa vinculado ao registro do lead. |
| RF062 | O sistema deve suportar templates de mensagem pré-aprovados (exigência da própria política do WhatsApp Business). |
| RF063 | (Fase intermediária, caso WhatsApp completo não caiba no MVP) — botão de abertura direta do WhatsApp Web com o número do lead, sem histórico integrado. |

### 4.8 Módulo: Relatórios e Dashboards

| ID | Requisito |
|---|---|
| RF070 | Dashboard com taxa de conversão por corretor e por equipe. |
| RF071 | Dashboard com tempo médio de resposta e tempo médio em cada etapa do funil. |
| RF072 | Dashboard com volume de leads recebidos x trabalhados x perdidos, por período. |
| RF073 | Filtros de todos os relatórios por período, corretor, equipe e origem do lead. |

### 4.9 Módulo: Segurança e LGPD

| ID | Requisito |
|---|---|
| RF080 | O sistema deve registrar consentimento explícito do titular dos dados (lead/cliente) para tratamento de dados sensíveis de saúde. |
| RF081 | O sistema deve manter logs de auditoria de acesso e alteração de dados sensíveis (quem acessou/alterou, quando, o quê). |
| RF082 | O sistema deve ter política de retenção de dados configurável (o que ocorre com dados após período de inatividade). |
| RF083 | Senhas e dados sensíveis devem ser armazenados com criptografia adequada; comunicação via HTTPS obrigatório. |

---

## 5. Requisitos Não Funcionais (RNF)

| ID | Requisito |
|---|---|
| RNF001 | O sistema deve ser multi-tenant com isolamento lógico de dados (estratégia: coluna `tenant_id` em todas as tabelas relevantes, com verificação em nível de aplicação e/ou RLS do PostgreSQL). |
| RNF002 | Tempo de resposta de páginas principais (dashboard, lista de leads) deve ser inferior a 2 segundos sob carga normal. |
| RNF003 | O sistema deve estar disponível 99% do tempo (SLA razoável para SaaS B2B em estágio inicial). |
| RNF004 | Interface responsiva, com uso viável em desktop e tablet (mobile como bônus, não crítico no MVP). |
| RNF005 | Código em TypeScript com tipagem ponta a ponta (Zod para validação de entrada, Drizzle para tipagem de banco). |
| RNF006 | Testes automatizados mínimos para regras críticas (cálculo de comissão, SLA de leads, permissões por papel). |
| RNF007 | Backups automáticos diários do banco de dados (recurso nativo do Neon/Supabase). |
| RNF008 | Escalabilidade horizontal viável via Vercel (serverless) sem necessidade de re-arquitetura para os primeiros ~50-100 tenants. |

---

## 6. Modelo de Dados (Entidades Principais)

Abaixo, as entidades centrais sugeridas para o schema Drizzle/PostgreSQL (nomes ilustrativos, ajustáveis):

- **tenants** — dados da corretora cliente (nome, plano de assinatura, status)
- **users** — usuários do sistema (vinculados a um tenant, papel: diretor/gestor/corretor)
- **leads** — dados do lead, status do funil, origem, corretor responsável, timestamps de SLA
- **lead_interactions** — histórico/timeline de interações do lead
- **operators** — operadoras de planos de saúde (Amil, Bradesco, etc.) — pode ser catálogo global
- **plans** — planos oferecidos por operadora (com regras de carência, faixas etárias)
- **price_tables** — tabelas de preço vinculadas a plano/operadora, com origem (manual ou scraping) e data de atualização
- **quotes** — cotações geradas para um lead
- **documents** — documentos enviados, vinculados a lead/cliente, com status de aprovação
- **document_checklists** — configuração de documentos obrigatórios por plano/operadora
- **sales** — venda fechada (lead convertido), vinculada a corretor, plano, data
- **commission_rules** — regras de comissão por operadora/plano (única ou escalonada)
- **commission_schedule** — cronograma de repasse gerado por venda (mês, percentual, status de pagamento)
- **whatsapp_conversations** / **whatsapp_messages** — histórico de conversas vinculado a lead
- **audit_logs** — logs de auditoria (LGPD)
- **subscriptions** — assinatura do tenant (plano, status, cobrança)

---

## 7. Arquitetura Técnica

### 7.1 Stack confirmada
- **Frontend/Backend:** Next.js (App Router) — full-stack em um único projeto
- **Banco de dados:** PostgreSQL (gerenciado via Neon ou Supabase)
- **ORM:** Drizzle ORM (type-safe)
- **Autenticação:** BetterAuth (multi-tenant, sessões, papéis)
- **Validação:** Zod (nas rotas de API e formulários)
- **Linguagem:** TypeScript (ponta a ponta)
- **Estilo:** Tailwind CSS
- **Hospedagem:** Vercel (aplicação) + Neon/Supabase (banco)

### 7.2 Estratégia de multi-tenancy
Recomendação: **banco compartilhado com coluna `tenant_id`** em todas as tabelas relevantes (abordagem mais simples e barata de operar para o volume esperado no início — dezenas a poucas centenas de tenants). Middleware/lib central deve garantir que toda query filtre por `tenant_id` da sessão ativa, evitando vazamento de dados entre corretoras. Se o volume crescer muito ou surgir exigência contratual de isolamento físico, migrar tenants grandes para schema dedicado é possível depois — não precisa ser resolvido na v1.

### 7.3 Integrações externas necessárias
- **WhatsApp Business API** — integração direta via Meta Cloud API (sem BSP intermediário), usando uma única conta Meta Business verificada da CorreTop. Cada corretora cliente tem seu número de telefone adicionado manualmente a essa conta pela equipe CorreTop (não é self-service para o cliente nesta fase). Se o volume de tenants crescer muito, avaliar tornar-se Tech Provider da Meta (Embedded Signup) para permitir que cada corretora conecte seu próprio número sozinha — decisão de escala, não do MVP.
- **Scraping de operadoras** — serviço isolado (job/worker separado, rodando em cron), para não travar a aplicação principal; resultado alimenta a tabela `price_tables`.
- **Gateway de cobrança recorrente (assinatura do tenant)** — sugestão: Stripe (se operar em USD/internacional) ou Asaas/Iugu/Pagar.me (se focado 100% em cobrança nacional recorrente com boleto/PIX, que é comum nesse tipo de cliente B2B brasileiro).
- **Storage de documentos** — S3-compatible (ex: Cloudflare R2, ou storage do próprio Supabase) para upload de documentos com controle de acesso.

---

## 8. Roadmap por Fases

### Fase 1 — MVP (foco: ter o primeiro tenant pagante operando o essencial)
- Multi-tenancy + autenticação + papéis (Diretor/Gestor/Corretor)
- Cadastro manual de leads + webhook genérico de recebimento
- Funil de status do lead + distribuição round-robin
- SLA básico (sem contato / sem atualização) com alerta e redistribuição
- Cotador com upload manual de tabelas (sem scraping ainda)
- Gestão documental completa (checklist + aprovação)
- Motor de comissão (única e escalonada configurável) + cronograma de repasse
- Dashboards: conversão, tempo de resposta, volume de leads
- LGPD básico: consentimento + logs de auditoria
- WhatsApp **simplificado**: botão que abre WhatsApp Web com o número do lead (sem histórico integrado ainda)
- Cobrança de assinatura do tenant (manual ou gateway simples)

### Fase 2 — Diferenciação competitiva
- Integração completa da API oficial do WhatsApp Business (caixa de entrada unificada, histórico por lead, templates)
- Scraping automático de tabelas de operadoras + alertas de falha
- Integrações prontas adicionais de captação de leads (Meta Lead Ads, Google Ads)
- Relatório financeiro consolidado (faturamento e comissões previsto x realizado)

### Fase 3 — Expansão e maturidade
- App mobile / PWA para corretores em campo
- Mais integrações de captação de leads
- Recursos avançados de auditoria/compliance para clientes maiores
- Possível migração de tenants grandes para isolamento físico de banco, se necessário

---

## 9. Riscos Técnicos e Recomendações Finais

1. **Crunch solo é insustentável a longo prazo.** Recomenda-se tratar o MVP da Fase 1 como o compromisso real de prazo, e comunicar claramente ao cliente que WhatsApp completo e scraping automático vêm na Fase 2 — isso protege tanto o prazo quanto a qualidade.
2. **Scraping de operadoras é manutenção contínua**, não um projeto "pronto e esquecido" — sites mudam de estrutura, e isso vai exigir tempo recorrente de manutenção mesmo após o lançamento.
3. **WhatsApp Business API tem custo por conversa** — é importante modelar esse custo e decidir se será repassado ao tenant (ex: plano com "pacote de mensagens incluso") ou absorvido na mensalidade.
4. **LGPD não é apenas uma feature técnica** — vale, no médio prazo, uma revisão por um profissional jurídico especializado em proteção de dados, já que o sistema trata dados de saúde de terceiros (pacientes/clientes das corretoras).

---

## 10. Próximos Passos Sugeridos (Rodada 1)

1. Validar este documento com o cliente/stakeholder da proposta (ou consigo mesmo, se for o dono do negócio).
2. Detalhar os limites de cada faixa do plano de assinatura (nº de usuários, nº de leads/mês).
3. Modelar o schema Drizzle definitivo com base na Seção 6.
4. Priorizar o backlog da Fase 1 em sprints/tarefas semanais, dado o regime de crunch.
5. Iniciar a verificação da conta Meta Business da própria CorreTop o quanto antes (2 a 10 dias úteis, não pode ser acelerado) e escolher o gateway de cobrança antes de iniciar a Fase 2 — a verificação é única para a CorreTop, não por tenant, e não depende de contratar um BSP.

---

## 11. Complementos ao Levantamento — Segunda Rodada de Requisitos

Esta seção adiciona requisitos identificados em uma segunda entrevista de aprofundamento, cobrindo administração interna do SaaS, ciclo de vida pós-venda, estrutura organizacional das corretoras e decisões operacionais que não haviam sido exploradas na primeira rodada.

### 11.1 Contexto importante que muda o dimensionamento do MVP

O primeiro cliente real confirmado é uma corretora **grande (20+ corretores, alto volume de leads)**. Isso eleva a prioridade de itens que antes pareciam "nice-to-have" para **requisitos reais do MVP**:

- Suporte a múltiplas filiais/unidades dentro do tenant (não é mais opcional).
- Metas comerciais por corretor e por equipe/filial.
- Performance do motor de distribuição (round-robin) e dos dashboards precisa ser validada com volume realista de leads simultâneos, não só com dados de teste pequenos.
- Vale considerar, desde o schema inicial, índices adequados em `leads`, `lead_interactions` e `commission_schedule` para evitar gargalos de consulta com alto volume.

### 11.2 Novos Requisitos Funcionais (RF090+)

**Painel de Super-Administração (CorreTop)**

| ID | Requisito |
|---|---|
| RF090 | Deve existir um painel de super-admin, acessível apenas pela equipe CorreTop, com listagem de tenants, status (ativo/inativo/inadimplente) e plano contratado. |
| RF091 | O super-admin deve poder ativar/desativar manualmente o acesso de um tenant. |
| RF092 | Não haverá período de trial — o acesso do tenant é liberado somente após confirmação de pagamento. |

**Estrutura Organizacional (Filiais/Unidades)**

| ID | Requisito |
|---|---|
| RF100 | O sistema deve suportar múltiplas filiais/unidades dentro de um mesmo tenant. |
| RF101 | Usuários (Gestor/Corretor) devem estar vinculados a uma filial específica. |
| RF102 | A distribuição round-robin de leads deve respeitar o escopo da filial de origem do lead, a menos que configurado de outra forma pelo Diretor. |
| RF103 | Relatórios e dashboards devem poder ser filtrados por filial, além dos filtros já previstos (corretor, equipe, período). |

**Disponibilidade do Corretor**

| ID | Requisito |
|---|---|
| RF110 | O corretor deve poder pausar/reativar seu próprio recebimento de novos leads (status "disponível"/"pausado"). |
| RF111 | O Gestor também deve poder pausar/reativar a disponibilidade de qualquer corretor da sua equipe. |
| RF112 | Não haverá controle de horário de trabalho/expediente no MVP — o corretor é considerado disponível por padrão, salvo pausa manual. |

**Metas Comerciais**

| ID | Requisito |
|---|---|
| RF120 | O Gestor/Diretor deve poder definir metas de vendas por corretor e por equipe/filial, com período (ex: mensal). |
| RF121 | O dashboard deve exibir o progresso da meta (ex: vendas realizadas / meta definida) por corretor e por equipe. |

**Pós-Venda / Cliente Ativo**

| ID | Requisito |
|---|---|
| RF130 | Ao converter um lead em venda, o sistema deve criar um registro de "Cliente Ativo" vinculado à venda, ao plano contratado e à data de aniversário do contrato. |
| RF131 | O sistema deve gerar alertas automáticos (in-app + push) próximos à data de aniversário/renovação do contrato do cliente. |
| RF132 | O corretor responsável deve poder registrar interações pós-venda (ex: contato de renovação, tentativa de upsell) vinculadas ao Cliente Ativo. |

**Catálogo de Operadoras e Planos (modelo híbrido)**

| ID | Requisito |
|---|---|
| RF140 | O sistema deve manter um catálogo global de operadoras e planos, mantido centralmente pela equipe CorreTop (incluindo tabelas via upload/scraping, conforme já definido na Seção 4.4). |
| RF141 | Cada tenant deve poder, adicionalmente, cadastrar seus próprios planos/operadoras específicos (ex: acordos exclusivos daquela corretora), visíveis apenas para o próprio tenant. |
| RF142 | Ao gerar uma cotação, o corretor deve poder escolher entre planos do catálogo global e planos próprios do tenant, sem distinção de fluxo. |

**Versionamento de Cotações**

| ID | Requisito |
|---|---|
| RF150 | Cada nova cotação gerada para um lead deve ser armazenada como um novo registro, preservando o histórico de cotações anteriores (não sobrescrever). |
| RF151 | A tela do lead deve exibir a linha do tempo de cotações geradas, com destaque para a mais recente. |

**Reatribuição de Leads (Desligamento de Corretor)**

| ID | Requisito |
|---|---|
| RF160 | O Gestor deve poder reatribuir manualmente, um a um, os leads e Clientes Ativos de um corretor desligado para outro corretor. |
| RF161 | Reatribuição em massa não é requisito do MVP (pode ser adicionado em fase futura caso o volume de desligamentos justifique). |

**Notificações**

| ID | Requisito |
|---|---|
| RF170 | O sistema deve emitir notificações in-app (painel/sino) para eventos relevantes: lead novo recebido, SLA prestes a estourar, documento aprovado/rejeitado, meta atingida, contrato próximo da renovação. |
| RF171 | O sistema deve suportar push notification via navegador para os mesmos eventos, quando o usuário permitir. |
| RF172 | E-mail e notificação automática via WhatsApp administrativo **não são requisitos do MVP**. |

**Suporte e Marca**

| ID | Requisito |
|---|---|
| RF180 | O sistema deve incluir um widget de chat de suporte embutido (pode ser solução de terceiros, ex: Crisp/Tawk.to, integrada via script). |
| RF181 | Cada tenant deve poder configurar logo e cor principal da marca, refletidos na interface do seu ambiente (white-label parcial). |

**Fora de Escopo (confirmado nesta rodada)**

| Item | Status |
|---|---|
| Assinatura eletrônica de documentos | Fora do MVP — previsto para Fase 2/3 |
| Exportação/portabilidade de dados (LGPD) via sistema | Fora do MVP — processo manual via suporte |
| Emissão de nota fiscal/recibo de comissão | Fora de escopo — responsabilidade da contabilidade da corretora |
| Gamificação/ranking de corretores | Fora do MVP — não é prioridade |
| Migração de dados de sistemas legados | Não se aplica no momento |

### 11.3 Atualização do Modelo de Dados

Novas entidades a incorporar no schema (complementando a Seção 6):

- **branches** — filiais/unidades de um tenant (nome, endereço, tenant_id)
- **users** — passa a incluir `branch_id` (vínculo obrigatório com uma filial)
- **goals** — metas comerciais (corretor_id ou team/branch_id, período, valor da meta)
- **active_customers** — cliente pós-venda (vinculado a `sales`, com data de aniversário/renovação, status)
- **customer_interactions** — interações pós-venda vinculadas a `active_customers`
- **quotes** — ajuste: cada geração cria novo registro, com campo `previous_quote_id` para rastrear a linha do tempo
- **tenant_plans** (ou campo em `plans`) — flag indicando se o plano é do catálogo global ou específico de um tenant
- **notifications** — notificações in-app (usuário, tipo, lida/não lida, link de referência)
- **tenant_branding** — logo e cor principal por tenant

### 11.4 Impacto no Roadmap

Ajuste sugerido na **Fase 1 (MVP)**, incorporando os itens que se tornaram obrigatórios pelo porte do primeiro cliente:

- Estrutura de filiais/unidades (RF100-103) — **movido para o MVP**, dado o porte do primeiro cliente.
- Metas comerciais por corretor/equipe (RF120-121) — **movido para o MVP**.
- Pós-venda / Cliente Ativo com alerta de renovação (RF130-132) — **movido para o MVP**, é um diferencial de retenção do próprio cliente da corretora.
- Painel de super-admin básico (RF090-092) — **incluído no MVP**, mesmo que enxuto.
- Notificações in-app + push (RF170-172) — **incluído no MVP**.
- White-label parcial (logo/cor) (RF181) — **incluído no MVP**, é diferencial comercial de baixo custo de implementação.
- Widget de suporte (RF180) — **incluído no MVP**, mas via ferramenta de terceiros (baixo esforço).

Seguem para **Fase 2/3** (sem mudança): assinatura eletrônica, integração WhatsApp completa, scraping automático, exportação LGPD self-service, gamificação, reatribuição em massa.

### 11.5 Riscos Adicionais Identificados

| Risco | Impacto | Mitigação |
|---|---|---|
| Primeiro cliente grande (20+ corretores) expõe qualquer gargalo de performance imediatamente, sem margem de "aprender com poucos usuários" | Alto | Modelar índices desde o schema inicial; testar distribuição round-robin com volume simulado antes do go-live |
| Escopo do MVP cresceu com a Rodada 2 (filiais, metas, pós-venda, super-admin) — risco de estourar ainda mais o prazo de crunch | Alto | Repriorizar rigorosamente; considerar adiar white-label e painel de super-admin avançado para logo após o go-live, mantendo o essencial: filiais, distribuição, cotação, documentos, comissão |
| Manter dados indefinidamente após cancelamento (decisão do cliente) pode gerar exposição regulatória futura | Médio | Documentar a decisão como escolha de produto; revisitar com apoio jurídico antes de escalar para muitos tenants |

### 11.6 Próximos Passos Atualizados

1. Repriorizar o backlog da Fase 1 considerando os itens movidos da Rodada 2 (filiais, metas, pós-venda, super-admin básico, notificações, white-label).
2. Definir, com a corretora grande (primeiro cliente), os nomes e estrutura real das filiais dela para validar o modelo de dados antes de codificar.
3. Simular round-robin e dashboards com volume de dados próximo ao real (20+ corretores, centenas/milhares de leads) antes do go-live, para evitar surpresas de performance.
4. Escolher a ferramenta de widget de chat de suporte (Crisp, Tawk.to, ou similar) e validar custo para o orçamento do projeto.
5. Formalizar, mesmo que em documento simples, a política de retenção de dados pós-cancelamento definida nesta rodada, para referência futura em caso de auditoria.

---

## 12. Jornada do Usuário e Diretrizes de UX

Esta seção traduz decisões de experiência do usuário levantadas em uma terceira rodada de entrevista (10 perguntas focadas em jornada), complementando os requisitos funcionais já definidos.

### 12.1 Jornada do Diretor

**Primeiro acesso:** ao logar pela primeira vez, o Diretor vê uma **tela de boas-vindas com checklist de primeiros passos**, sem fluxo forçado (o Diretor pode navegar livremente e voltar ao checklist quando quiser). Sugestão de itens do checklist:
- ☐ Criar sua primeira filial/unidade
- ☐ Convidar gestores e corretores
- ☐ Configurar/revisar seu catálogo de planos
- ☐ Personalizar logo e cor da marca (white-label)
- ☐ Definir metas comerciais da equipe

**Uso recorrente:** navegação própria do papel Diretor (menu diferenciado por papel — ver 12.4), com acesso total a relatórios, configurações do tenant, filiais e faturamento.

### 12.2 Jornada do Corretor

**Home / tela inicial ao logar:** dashboard pessoal com métricas — conversão, progresso da meta do mês, leads pendentes. O corretor entra vendo seu "placar pessoal" antes de mergulhar na fila de trabalho.

**Fila de leads:** lista/tabela simples, ordenável e filtrável (não kanban — decisão tomada para reduzir esforço de implementação no MVP, mantendo a mesma utilidade prática).

**Recebimento de novo lead:** notificação **chamativa** — push notification + destaque visual (banner/som), já que leads de plano de saúde esfriam rápido e a velocidade de resposta é um fator crítico de conversão nesse mercado.

**Tela de detalhe do lead:** organizada como painel de ação — dados do lead + botões de ação (mudar status, gerar cotação, upload de documento) na tela principal; o chat com o cliente (WhatsApp) fica em uma aba separada dentro do mesmo contexto, evitando poluição visual.

**Geração de cotação:** fluxo rápido em modal/painel dentro da própria tela do lead (single-step), sem tirar o corretor do contexto — importante para quando ele está no meio de um atendimento e precisa cotar rapidamente.

### 12.3 Jornada do Gestor

**Home / tela inicial:** estrutura sugerida em camadas, priorizando ação sobre contemplação:
1. Faixa de alertas críticos no topo (leads não trabalhados, documentos pendentes de aprovação, contratos vencendo), cada card clicável levando direto à fila filtrada correspondente.
2. Visão da equipe logo abaixo — tabela com cada corretor da(s) filial(is) que gerencia: leads ativos, conversão, progresso da meta (barra visual), status de disponibilidade.
3. Gráfico de funil da equipe, para identificar gargalos por etapa.

**Aprovação de documentos:** o Gestor/Diretor trabalha a partir de uma **fila central de aprovação** — uma "caixa de entrada" com todos os documentos pendentes de todos os leads, permitindo revisar em sequência sem precisar navegar lead por lead.

### 12.4 Navegação e Padrões de Interface

| Decisão | Definição |
|---|---|
| Estrutura de menu | Menu totalmente diferente por papel — Diretor, Gestor e Corretor cada um vê apenas os itens relevantes à sua função, reduzindo ruído cognitivo (especialmente para o Corretor) |
| Navegação mobile | Menu hambúrguer/lateral (não bottom nav), reaproveitando a mesma estrutura de itens do menu desktop por papel |
| Visualização de leads | Lista/tabela ordenável e filtrável no MVP; kanban visual fica como possível view alternativa em fase futura |
| Geração de cotação | Modal/painel single-step dentro da tela do lead, não um wizard de múltiplas etapas |
| Aprovação de documentos | Fila central única, não aprovação dispersa lead por lead |

### 12.5 Implicações Técnicas das Decisões de UX

- O **menu diferenciado por papel** deve ser resolvido via configuração declarativa (ex: um array de itens de menu com a lista de papéis permitidos por item), evitando duplicar componentes de navegação.
- A **fila central de aprovação de documentos** exige uma consulta agregada entre tenants/filiais que o Gestor/Diretor supervisiona, unindo documentos de múltiplos leads — vale considerar isso no design das queries desde o schema inicial (índices em `documents.status` e `documents.lead_id`).
- O **dashboard pessoal do Corretor** (home) depende diretamente do módulo de metas (RF120-121) estar funcional cedo no desenvolvimento, já que é a primeira tela que o corretor vê todo dia — vale priorizar esse cálculo de progresso de meta no cronograma.
- **Notificação chamativa de novo lead** (push + banner/som) deve ser tratada com cuidado técnico: push notifications no navegador exigem permissão do usuário e Service Worker configurado — testar bem esse fluxo em diferentes navegadores/dispositivos móveis antes do go-live, já que é um requisito crítico de velocidade de resposta.

---

## 13. Refinamentos de UX — Rodada Final (Detalhes Operacionais)

Esta seção consolida uma quarta rodada de entrevista (20 perguntas), fechando lacunas operacionais de UX que não haviam sido cobertas: onboarding de equipe, estados vazios, segurança de acesso, PWA, filtros salvos, e uma priorização final do escopo do MVP sob pressão de prazo.

### 13.1 Onboarding e Convites

| Decisão | Definição |
|---|---|
| Convite de Gestor/Corretor | Envio de convite por e-mail com link para o próprio usuário criar sua senha (sem senha provisória circulando por WhatsApp/print) |
| Estado vazio da fila do Corretor novo | Mensagem simples: "Nenhum lead por enquanto, aguarde a distribuição" — sem tentar preencher o vazio com conteúdo promocional |

### 13.2 Sinalização Visual e Urgência

| Decisão | Definição |
|---|---|
| Urgência de SLA na lista de leads | Ícone/badge + cor (não cor sozinha, por acessibilidade) — verde (dentro do prazo), amarelo + ícone de relógio (perto de estourar), vermelho + ícone de alerta (SLA estourado). Lista ordenada por urgência por padrão |
| Motivo de perda de lead | Lista fixa de motivos pré-definidos (padroniza dados para relatório de "principais motivos de perda") |
| Identidade visual padrão (antes do white-label do tenant) | Azul como cor de marca padrão do CorreTop |

### 13.3 Produtividade e Ações em Lote

| Decisão | Definição |
|---|---|
| Ações em massa | Necessário no MVP pelo menos para aprovação de documentos (selecionar vários e aprovar em lote, aproveitando a fila central já definida na Seção 12.3) |
| Filtros salváveis | Necessário no MVP — usuário pode salvar combinações de filtro com nome próprio (ex: "Minha fila de hoje") |
| Busca | Busca global disponível em qualquer tela, com atalho de teclado (padrão tipo Cmd/Ctrl+K) |
| Paginação | Paginação tradicional (números de página), não scroll infinito |
| Confirmação de ações críticas | Modal de confirmação antes de ações irreversíveis (perder lead, excluir documento, desligar corretor) |

### 13.4 Multi-filial

| Decisão | Definição |
|---|---|
| Alternância entre filiais | Seletor de filial ativa no topo da tela — troca todo o contexto (dashboard, fila, relatórios) conforme a filial selecionada |

### 13.5 Segurança

| Decisão | Definição |
|---|---|
| 2FA | Opcional (usuário ativa se quiser), mas disponível desde o MVP — via TOTP (Google Authenticator/Authy) |

### 13.6 Mobile e PWA

| Decisão | Definição |
|---|---|
| Formato de acesso mobile | PWA instalável (não apenas site responsivo) — decisão reforçada pelo fato de que push notifications (RF171) já exigem Service Worker, tornando o PWA um incremento de baixo esforço adicional |

### 13.7 Cotação, Ajuda e Notificações

| Decisão | Definição |
|---|---|
| Entrega da cotação ao cliente | Geração de PDF para download e envio manual (WhatsApp, e-mail); sem página pública compartilhável no MVP |
| Exportação de relatórios | Excel/CSV é essencial no MVP (fechamento de comissão mensal); PDF pode vir depois |
| Tooltips/ajuda contextual | Sim, nos pontos mais complexos (comissão escalonada, regras de SLA), reduzindo carga sobre o chat de suporte |
| Central de notificações (sino) | Dropdown simples com as últimas notificações, sem página dedicada de histórico no MVP |
| Chat integrado (WhatsApp) | Indicadores de "visto" e "digitando" desejados — **ressalva técnica**: a Meta Cloud API suporta confirmação de entrega/leitura, mas o indicador de "digitando..." normalmente não é exposto da mesma forma para o lado da empresa; validar disponibilidade diretamente na documentação da Cloud API antes de prometer paridade total com o app nativo |

### 13.8 Priorização Final do MVP (definida pelo dono do projeto)

Diante da possibilidade do prazo apertar durante o crunch, a ordem de criticidade definida para o primeiro cliente (corretora grande) é:

1. **Distribuição de leads + SLA + funil** (núcleo do CRM) — inegociável, é a espinha dorsal do sistema.
2. **WhatsApp integrado com chat completo** — priorizado acima do módulo financeiro, pois velocidade de resposta ao lead é vista como mais crítica no dia 1 do que o motor de comissão completo.
3. **Cotador + gestão documental + comissão** — essencial, mas pode, em último caso, ser acompanhado de forma mais manual por um período inicial se o prazo apertar muito.
4. **Metas comerciais + dashboard + pós-venda** — importante para gestão e retenção, mas é o primeiro candidato a ficar para uma entrega logo após o go-live, caso necessário.

**Implicação prática:** isso sugere reavaliar a ordem de desenvolvimento sugerida na Seção 11.4 — o esforço de integração com a Meta Cloud API deveria começar **em paralelo** ao núcleo do CRM (não depois), já que a verificação da conta Meta Business e a aprovação de templates têm prazos fora do seu controle direto (2 a 10 dias úteis, não pode ser acelerado). Como a verificação é única para a CorreTop (não por tenant, e não depende de contratar um BSP), iniciar isso cedo evita que vire o gargalo do lançamento.

---

## 14. Módulo de Controle e Integridade (Antifraude / Anti-Fuga de Leads)

Esta seção documenta uma quinta rodada de entrevista (10 perguntas), focada especificamente em mecanismos de controle para Gestores e Diretores contra fuga de leads e desvio de operação — um diferencial competitivo relevante do CorreTop, já que esse é um problema operacional crônico e mal resolvido no mercado de corretoras.

### 14.1 Contexto e Motivação

Fuga de leads (corretor atender/fechar venda por fora do sistema, sem repassar comissão ou sem registrar a operação) é um risco financeiro direto para o dono da corretora. Como o cliente optou por **manter o telefone completo visível** ao corretor (não mascarar o contato), o controle antifraude do CorreTop se apoia em **três pilares**: rastreabilidade (logs), detecção de padrões anômalos (alertas automáticos) e verificação ativa (reengajamento de leads perdidos) — não em restrição de acesso à informação.

### 14.2 Novos Requisitos Funcionais (RF190+)

**Rastreabilidade e Logs**

| ID | Requisito |
|---|---|
| RF190 | O telefone completo do lead permanece visível ao corretor responsável (decisão de produto: não mascarar contato). |
| RF191 | Toda exportação de dados de leads/clientes deve ser registrada em log (quem exportou, quando, quantidade de registros), disponível para consulta por Gestor/Diretor. Exportação não é bloqueada para nenhum papel. |
| RF192 | O sistema deve manter histórico de login/sessão por usuário (último acesso, IP, dispositivo), visível para Gestor e Diretor. |

**Detecção de Padrões Anômalos**

| ID | Requisito |
|---|---|
| RF193 | O sistema deve calcular a taxa de perda de leads por corretor e compará-la com a média da equipe/filial, disparando alerta automático ao Gestor quando o desvio ultrapassar um limite configurável (ex: X desvios-padrão acima da média). |
| RF194 | O sistema deve emitir um alerta de **"estagnação"**, distinto do alerta de SLA por falta de interação (RF022-023): dispara quando um lead permanece na mesma etapa do funil por tempo além do limite configurável, mesmo havendo interações registradas. |

**Verificação Ativa**

| ID | Requisito |
|---|---|
| RF195 | O sistema deve reengajar automaticamente **todos** os leads marcados como "Perdidos" após um período configurável, com uma mensagem de tom neutro/acolhedor (ex: verificação de satisfação), sem qualquer indício para o lead de que se trata de um mecanismo de auditoria. |

**Ações de Gestão sobre Casos Suspeitos**

| ID | Requisito |
|---|---|
| RF196 | O Gestor/Diretor deve poder reabrir um lead marcado como "Perdido" e reatribuí-lo a outro corretor para retomada/investigação. |
| RF197 | O Gestor/Diretor deve poder gerar/exportar um relatório de evidências (histórico completo de interações, mudanças de status e mensagens) de um lead específico, para uso em medida disciplinar ou jurídica. |

**Isolamento de Carteira**

| ID | Requisito |
|---|---|
| RF198 | Um corretor não deve ter nenhuma visibilidade sobre leads/clientes de outros corretores, mesmo da mesma filial — isolamento total, reforçando o RF005. |

**Painel de Integridade/Auditoria**

| ID | Requisito |
|---|---|
| RF199 | Deve existir um painel central de Integridade/Auditoria, visível para Gestor e Diretor, consolidando: corretores com taxa de perda anormal, leads estagnados, exportações de dados recentes e acessos/logins fora do padrão (ex: IP incomum, múltiplos dispositivos). |
| RF200 | O painel deve permitir navegar diretamente do alerta para a ação correspondente (ex: clicar no alerta de taxa de perda anormal leva à lista filtrada de leads perdidos daquele corretor). |

**Fora de Escopo (confirmado nesta rodada)**

| Item | Status |
|---|---|
| Conciliação automática com relatório de apólices ativas da operadora | Fora do MVP — previsto para Fase 2/3, viabilidade depende de as operadoras fornecerem esse relatório de forma acessível |
| Mascaramento/ocultação do telefone do lead | Não será implementado — decisão de produto do cliente |
| Bloqueio de exportação de dados por papel | Não será implementado — controle é via log/auditoria, não restrição |

### 14.3 Atualização do Modelo de Dados

Novas entidades/campos a incorporar (complementando as Seções 6 e 11.3):

- **login_sessions** — histórico de sessões de usuário (user_id, IP, dispositivo/user-agent, timestamp de login)
- **data_export_logs** — registro de exportações (user_id, tipo de dado exportado, quantidade de registros, timestamp)
- **leads** — campo adicional `stage_entered_at` (timestamp de quando o lead entrou na etapa atual do funil), necessário para calcular o alerta de estagnação (RF194)
- **integrity_alerts** — tabela consolidando os alertas gerados (tipo: taxa_perda_anormal / estagnacao / login_suspeito / export_volumoso, corretor/usuário relacionado, status: pendente/revisado, timestamp)

### 14.4 Atualização da Jornada do Usuário (Seção 12)

**Painel de Integridade/Auditoria — Gestor e Diretor**

Nova tela acessível pelo menu do Gestor/Diretor, organizada como:

1. **Lista de alertas ativos**, agrupados por tipo (taxa de perda anormal, estagnação, login suspeito, exportação volumosa), cada um com o corretor envolvido e um resumo do desvio detectado (ex: "Taxa de perda 3x acima da média da equipe").
2. **Ação direta a partir do alerta** — clicar leva à lista filtrada de leads relacionados, à tela de reatribuição, ou à exportação do relatório de evidências.
3. **Filtro por filial**, reaproveitando o seletor de filial já definido na Seção 12.4/13.4, para Diretores que supervisionam múltiplas unidades.

Isso se conecta diretamente à tela de aprovação central de documentos (Seção 12.3) e à fila central definida anteriormente — o padrão de "central única de ação" se repete de forma consistente na experiência do Gestor/Diretor em todo o sistema.

### 14.5 Nota sobre Sensibilidade da Comunicação com o Lead

O reengajamento automático de leads perdidos (RF195) precisa ser redigido com cuidado editorial: a mensagem deve soar como cuidado genuíno com o cliente (ex: "Olá! Notamos que você não seguiu com a contratação — ainda podemos ajudar com alguma dúvida sobre planos de saúde?"), nunca como cobrança ou investigação. Isso protege tanto a experiência do lead quanto a relação da corretora com seus próprios clientes/prospects — o mecanismo antifraude deve ser invisível para quem está do lado de fora.

---

## 15. Mapa Completo do Sistema (Ponta a Ponta)

Esta seção consolida o sistema em três camadas complementares — negócio, telas por papel, e arquitetura técnica — reunindo tudo o que foi definido nas seções anteriores em uma visão única de ponta a ponta. Os diagramas simplificados foram apresentados na conversa; o detalhamento completo de cada camada está abaixo.

### 15.1 Camada 1 — Fluxo de Negócio Ponta a Ponta

```
Captação → Distribuição → Atendimento/Cotação → Documentação → Venda/Comissão → Pós-venda
                                                                                        ↺ (renovação)
```

**1. Captação de leads** — entrada manual (corretor cadastra) ou automática (webhook genérico + integrações prontas, ex: Meta Lead Ads), conforme Seção 4.2.

**2. Distribuição** — round-robin automático entre corretores disponíveis, respeitando o escopo da filial de origem (Seção 11.2 — RF102). Corretor pode se pausar manualmente (RF110-112).

**3. Atendimento e cotação** — funil de status (Novo → Distribuído → Em Atendimento → Cotação Enviada → Negociação), com SLA duplo monitorando: falta de interação (RF022-023) e estagnação na mesma etapa (RF194). Cotação gerada em modal rápido (Seção 12.2), com versionamento (RF150-151), entregue como PDF para download.

**4. Documentação** — checklist configurável por plano/operadora, upload pelo corretor ou cliente, aprovação via fila central (Seção 12.3), com ações em lote (Seção 13.3).

**5. Venda e comissão** — conversão do lead em venda, geração automática do cronograma de repasse (comissão única ou escalonada, RF050-054), cria registro de Cliente Ativo (RF130).

**6. Pós-venda** — acompanhamento do Cliente Ativo, alertas de renovação/aniversário de contrato (RF131), interações de upsell (RF132) — fecha o ciclo, podendo reabrir uma nova cotação em caso de renovação/mudança de plano.

**Camada paralela — Integridade/Auditoria:** em todas as etapas acima, o sistema monitora sinais de risco em segundo plano — taxa de perda anormal por corretor, estagnação de leads, exportações de dados e logins fora do padrão — consolidados no Painel de Integridade (Seção 14), sem interromper o fluxo principal do negócio.

### 15.2 Camada 2 — Telas por Papel (Sitemap)

**Diretor**
- Tela de boas-vindas / checklist de primeiros passos (primeiro acesso)
- Configurações do tenant: filiais/unidades, white-label (logo/cor), catálogo de planos próprios
- Gestão de usuários (criar/editar Gestores e Corretores, convites por e-mail)
- Todos os relatórios e dashboards (consolidado ou filtrado por filial via seletor)
- Painel de Integridade/Auditoria
- Definição de metas comerciais (por corretor/equipe/filial)
- Configurações de assinatura/plano contratado do CorreTop

**Gestor**
- Home: alertas críticos (leads não trabalhados, documentos pendentes, contratos vencendo) + visão da equipe + funil da equipe
- Fila central de aprovação de documentos (com ação em lote)
- Painel de Integridade/Auditoria (mesma visão do Diretor, escopo da(s) filial(is) sob sua gestão)
- Gestão da equipe: pausar/reativar disponibilidade de corretores, reatribuir leads manualmente
- Relatórios filtrados pela(s) filial(is) que supervisiona
- Definição/acompanhamento de metas da sua equipe

**Corretor**
- Home: dashboard pessoal (conversão, progresso da meta, leads pendentes)
- Fila de leads (lista ordenável/filtrável, com filtros salváveis)
- Tela de detalhe do lead: dados + ações (mudar status, gerar cotação, upload de documento) + aba de chat WhatsApp
- Tela de Clientes Ativos (pós-venda, interações de renovação)
- Busca global (atalho de teclado)

**Transversal a todos os papéis:** central de notificações (dropdown do sino), widget de chat de suporte, alternância de tema claro/escuro, navegação mobile via menu hambúrguer/lateral (PWA instalável).

### 15.3 Camada 3 — Arquitetura Técnica

**Aplicação:** Next.js (App Router, full-stack) hospedado na Vercel — frontend e API no mesmo projeto, TypeScript ponta a ponta, validação via Zod, autenticação via BetterAuth (incluindo suporte a 2FA opcional via TOTP).

**Banco de dados:** PostgreSQL gerenciado (Neon ou Supabase), acessado via Drizzle ORM, com isolamento multi-tenant por coluna `tenant_id` em todas as tabelas relevantes.

**Integrações externas:**
- **WhatsApp Business API** — integração direta via Meta Cloud API, sem BSP intermediário; conta Meta Business única e verificada da CorreTop, com números de cada corretora adicionados manualmente pela equipe CorreTop — chat integrado por lead, com confirmação de entrega/leitura (limitação: indicador de "digitando..." não garantido pela API)
- **Scraping de operadoras** — job/worker isolado (cron), alimenta a tabela de tabelas de preço, com fallback manual em caso de falha
- **Storage de documentos** — S3-compatible (Cloudflare R2 ou storage do Supabase), com controle de acesso por tenant
- **Gateway de cobrança recorrente** — Asaas/Iugu/Pagar.me ou Stripe, para a assinatura mensal do tenant
- **Widget de suporte** — solução de terceiros (Crisp/Tawk.to), integrada via script

**Notificações:** in-app (persistidas em tabela `notifications`) + push via navegador (exige Service Worker, o mesmo que viabiliza o PWA instalável).

### 15.4 Como as Três Camadas se Conectam

O fluxo de negócio (15.1) é o que o **usuário vive**; as telas por papel (15.2) são **onde ele vive isso**; a arquitetura técnica (15.3) é **o que sustenta tudo por baixo**, sem o usuário nunca precisar vê-la diretamente. Uma mudança em qualquer uma das camadas tende a exigir revisão nas outras duas — por exemplo, a decisão de ter chat completo do WhatsApp (camada de negócio) exigiu Service Worker (camada técnica), que por sua vez viabilizou o PWA instalável (camada de tela/experiência) sem custo adicional de desenvolvimento.

---

*Documento gerado a partir de levantamento de requisitos estruturado (2 rodadas de 20 perguntas de requisitos + 2 rodadas de jornada/UX de 10 e 20 perguntas + 1 rodada de 10 perguntas de controle/integridade + mapa completo do sistema em 3 camadas) para o projeto CorreTop.*
