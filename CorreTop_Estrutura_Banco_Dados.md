# CorreTop — Estrutura de Dados e Plano do Banco (Ponta a Ponta)

> **Estado de implementação (2026-07-11).** A fonte de verdade do Drizzle é
> `src/shared/db/schema.ts`, referenciada por `drizzle.config.ts`. O `schema.ts` na raiz
> agora é somente uma reexportação de compatibilidade e não pode receber tabelas ou
> migrations. A migration inicial implementa a fundação segura: tabelas BetterAuth
> (`user`, `session`, `account`, `verification`), `tenants`, `branches` e
> `tenant_memberships`, com chave composta que impede uma associação de filial entre
> tenants. As entidades comerciais abaixo permanecem o contrato alvo e só entram em
> migration depois da decisão bloqueante correspondente em `docs/decision-log.md`.
> O bootstrap inicial sempre cria a identidade BetterAuth e o vínculo de diretor no mesmo
> tenant; ele recusa um e-mail que já pertença a outra corretora.

**Versão:** 1.0
**Escopo:** Especificação completa de todas as entidades do sistema, organizadas hierarquicamente a partir da Empresa Cliente (tenant), com campos, tipos e relacionamentos. Complementa o Documento de Requisitos e a Arquitetura de Desenvolvimento.

---

## 1. Como Ler Este Documento

A estrutura segue a hierarquia real do negócio:

```
Empresa Cliente (Tenant)
 └─ Configurações do Tenant (marca, catálogo próprio, assinatura)
 └─ Filiais/Unidades
     └─ Usuários (Diretor, Gestor, Corretor)
         └─ Operação Comercial (Leads → Cotação → Documentos → Venda → Comissão → Pós-venda)
         └─ Controle e Integridade (logs, alertas, sessões)
```

Cada seção abaixo lista uma entidade (futura tabela no Postgres), seus campos principais, tipo de dado, e a que ela se relaciona. Chaves estrangeiras estão marcadas com **FK**.

---

## 2. Nível 0 — Empresa Cliente (Tenant)

A raiz de tudo. Toda outra tabela do sistema (exceto o catálogo global) carrega uma referência a este registro.

### `tenants`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Identificador único do tenant |
| `nome_fantasia` | text | Nome da corretora |
| `razao_social` | text | Razão social (CNPJ) |
| `cnpj` | text | Documento da empresa |
| `status` | enum | `ativo` / `inativo` / `inadimplente` |
| `plano_assinatura_id` | uuid (FK → `subscription_plans`) | Faixa de plano contratado |
| `created_at` | timestamp | Data de criação do tenant |

### `subscriptions`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `tenant_id` | uuid (FK → `tenants`) | — |
| `plano` | enum | Faixa contratada (ex: básico/intermediário/grande) |
| `status_pagamento` | enum | `em_dia` / `atrasado` / `cancelado` |
| `data_inicio` | date | — |
| `data_proxima_cobranca` | date | — |

### `tenant_branding`
| Campo | Tipo | Descrição |
|---|---|---|
| `tenant_id` | uuid (FK → `tenants`, PK) | Um registro por tenant |
| `logo_url` | text | URL do logo no storage |
| `cor_primaria` | text | Cor em hex, aplicada via CSS variables |

---

## 3. Nível 1 — Filiais/Unidades

### `branches`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `tenant_id` | uuid (FK → `tenants`) | — |
| `nome` | text | Nome da filial (ex: "Matriz SP", "Filial RJ") |
| `endereco` | text | — |
| `ativa` | boolean | — |

---

## 4. Nível 2 — Usuários (Diretor, Gestor, Corretor)

### `user` e `tenant_memberships`

Na implementação atual, o BetterAuth mantém a identidade global em `user` e o escopo
operacional em `tenant_memberships`. A combinação `tenant_id` + `user_id` é única; a
filial, quando presente, é validada pela chave estrangeira composta com o mesmo tenant.
Os nomes de campos da tabela abaixo representam o contrato alvo; novos módulos devem se
referir a `user.id` e `tenant_memberships` em vez de criar uma segunda tabela `users`.
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `tenant_id` | uuid (FK → `tenants`) | Isolamento multi-tenant |
| `branch_id` | uuid (FK → `branches`) | Filial de vínculo |
| `nome` | text | — |
| `email` | text | Único, usado no login |
| `papel` | enum | `diretor` / `gestor` / `corretor` |
| `status_disponibilidade` | enum | `disponivel` / `pausado` (round-robin) |
| `ativo` | boolean | Ativo/desligado |
| `dois_fatores_ativo` | boolean | 2FA opcional |
| `criado_em` | timestamp | — |

### `login_sessions`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `user_id` | uuid (FK → `users`) | — |
| `ip` | text | — |
| `dispositivo` | text | User-agent |
| `criado_em` | timestamp | Momento do login |

### `saved_filters`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `user_id` | uuid (FK → `users`) | Dono do filtro |
| `nome` | text | Ex: "Minha fila de hoje" |
| `filtros_json` | jsonb | Combinação de filtros salva |

### `goals` (metas comerciais)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `tenant_id` | uuid (FK → `tenants`) | — |
| `escopo` | enum | `corretor` / `equipe` / `filial` |
| `referencia_id` | uuid | ID do corretor ou da filial, conforme escopo |
| `periodo` | text | Ex: "2026-07" (mês/ano) |
| `meta_vendas` | integer | Quantidade-alvo |

---

## 5. Nível 3 — Operação Comercial (Leads)

### `leads`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `tenant_id` | uuid (FK → `tenants`) | — |
| `branch_id` | uuid (FK → `branches`) | — |
| `corretor_id` | uuid (FK → `users`) | Corretor responsável atual |
| `nome` | text | — |
| `telefone` | text | Completo, visível ao corretor (decisão de produto) |
| `email` | text | — |
| `origem` | enum | `manual` / `webhook` / integração específica |
| `status` | enum | Novo, Distribuído, Em Atendimento, Cotação Enviada, Negociação, Documentação Pendente, Em Análise, Convertido, Perdido |
| `motivo_perda` | enum, nullable | Lista fixa (preço, concorrente, desistência, sem resposta, etc.) |
| `stage_entered_at` | timestamp | Quando entrou na etapa atual (base do alerta de estagnação) |
| `consentimento_lgpd` | boolean | Consentimento do titular para dados sensíveis |
| `criado_em` | timestamp | — |

### `lead_interactions` (timeline)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `lead_id` | uuid (FK → `leads`) | — |
| `user_id` | uuid (FK → `users`) | Quem registrou |
| `tipo` | enum | Mudança de status, nota, mensagem, upload de doc |
| `conteudo` | text | — |
| `criado_em` | timestamp | Usado no cálculo de SLA |

### Catálogo (Nível 0, mas usado aqui)

**`operators`** (operadoras — catálogo global, mantido pela CorreTop)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `nome` | text | Ex: Amil, Bradesco Saúde |

**`plans`** (planos — global ou específico de tenant)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `operator_id` | uuid (FK → `operators`) | — |
| `tenant_id` | uuid, nullable (FK → `tenants`) | `null` = catálogo global; preenchido = plano exclusivo do tenant |
| `nome` | text | — |
| `regras_carencia` | jsonb | — |

**`price_tables`**
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `plan_id` | uuid (FK → `plans`) | — |
| `origem` | enum | `upload_manual` / `scraping` (fase futura) |
| `arquivo_url` | text | — |
| `atualizado_em` | timestamp | — |

### `quotes` (cotações, com versionamento)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `lead_id` | uuid (FK → `leads`) | — |
| `plan_id` | uuid (FK → `plans`) | — |
| `previous_quote_id` | uuid, nullable (FK → `quotes`) | Encadeia o histórico de versões |
| `valor_calculado` | numeric | — |
| `pdf_url` | text | — |
| `criado_em` | timestamp | — |

### `document_checklists`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `plan_id` | uuid (FK → `plans`) | — |
| `nome_item` | text | Ex: "RG", "Comprovante de residência" |
| `obrigatorio` | boolean | — |

### `documents`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `lead_id` | uuid (FK → `leads`) | — |
| `checklist_item_id` | uuid (FK → `document_checklists`) | — |
| `arquivo_url` | text | Storage S3-compatible |
| `status` | enum | `pendente` / `aprovado` / `rejeitado` |
| `observacao` | text, nullable | Motivo de rejeição |
| `enviado_por` | uuid (FK → `users`) | — |
| `revisado_por` | uuid, nullable (FK → `users`) | — |

---

## 6. Nível 4 — Venda, Comissão e Pós-venda

### `sales`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `lead_id` | uuid (FK → `leads`) | — |
| `corretor_id` | uuid (FK → `users`) | — |
| `plan_id` | uuid (FK → `plans`) | — |
| `data_venda` | date | Base do cálculo de comissão |
| `valor_venda` | numeric | — |

### `commission_rules`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `plan_id` | uuid (FK → `plans`) | — |
| `tipo` | enum | `unica` / `escalonada` |
| `percentuais_json` | jsonb | Ex: `[100, 25, 5]` para meses 1, 2, 3 |

### `commission_schedule` (cronograma de repasse)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `sale_id` | uuid (FK → `sales`) | — |
| `mes_referencia` | integer | 1, 2, 3... |
| `valor` | numeric | — |
| `status_pagamento` | enum | `previsto` / `pago` |

### `active_customers` (Cliente Ativo — pós-venda)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `sale_id` | uuid (FK → `sales`) | — |
| `data_aniversario_contrato` | date | Base do alerta de renovação |
| `status` | enum | `ativo` / `cancelado` |

### `customer_interactions`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `active_customer_id` | uuid (FK → `active_customers`) | — |
| `tipo` | enum | `renovacao` / `upsell` / `contato_geral` |
| `conteudo` | text | — |
| `criado_em` | timestamp | — |

---

## 7. Controle, Integridade e Comunicação (Transversais)

### `data_export_logs`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `user_id` | uuid (FK → `users`) | Quem exportou |
| `tipo_dado` | text | Ex: "leads", "comissões" |
| `quantidade_registros` | integer | — |
| `criado_em` | timestamp | — |

### `integrity_alerts` (Painel de Integridade)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `tenant_id` | uuid (FK → `tenants`) | — |
| `tipo` | enum | `taxa_perda_anormal` / `estagnacao` / `login_suspeito` / `exportacao_volumosa` |
| `user_id` | uuid, nullable (FK → `users`) | Corretor/usuário relacionado |
| `detalhe_json` | jsonb | Dados do desvio detectado |
| `status` | enum | `pendente` / `revisado` |
| `criado_em` | timestamp | — |

### `audit_logs` (LGPD)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `user_id` | uuid (FK → `users`) | Quem acessou/alterou |
| `entidade` | text | Ex: "lead", "document" |
| `entidade_id` | uuid | — |
| `acao` | enum | `visualizou` / `criou` / `alterou` / `excluiu` |
| `criado_em` | timestamp | — |

### `notifications`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `user_id` | uuid (FK → `users`) | Destinatário |
| `tipo` | text | Ex: "lead_novo", "sla_estourado", "meta_atingida" |
| `lida` | boolean | — |
| `link_referencia` | text | Deep link pra tela relevante |
| `criado_em` | timestamp | — |

### `whatsapp_connections`
| Campo | Tipo | Descrição |
|---|---|---|
| `tenant_id` | uuid (FK → `tenants`, PK) | Um número por tenant |
| `phone_number_id` | text | ID da Meta Cloud API |
| `access_token` | text | Criptografado |
| `conectado_em` | timestamp | — |

### `whatsapp_messages`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `lead_id` | uuid (FK → `leads`) | — |
| `direcao` | enum | `enviada` / `recebida` |
| `conteudo` | text | — |
| `status_entrega` | enum | `enviada` / `entregue` / `lida` |
| `criado_em` | timestamp | — |

---

## 8. Índices Recomendados (Performance desde o Início)

Dado que o primeiro cliente é grande (20+ corretores, alto volume), estes índices evitam gargalo desde o dia 1:

- `leads (tenant_id, branch_id, status)` — filtro mais comum nas filas
- `leads (corretor_id, status)` — fila pessoal do corretor
- `lead_interactions (lead_id, criado_em)` — cálculo de SLA
- `documents (status, lead_id)` — fila central de aprovação
- `integrity_alerts (tenant_id, status)` — painel de integridade
- `commission_schedule (sale_id, mes_referencia)` — fechamento mensal

---

## 9. Regra de Isolamento Multi-tenant

Toda tabela que carrega `tenant_id` (diretamente ou via `lead_id`/`user_id`) deve passar pelo helper central de acesso ao banco (ver Arquitetura de Desenvolvimento, Seção 13) — nunca uma query "crua" que dependa do desenvolvedor lembrar de filtrar manualmente.

---

*Este documento acompanha `src/shared/db/schema.ts` (Drizzle). A fundação de identidade e
multi-tenancy já está migrada; os demais blocos deste plano são implementados somente após
as decisões de produto e segurança correspondentes.*
