# Arquitetura Plugin First do CorreTop

**Status:** aprovada como direção arquitetural incremental — 2026-07-15  
**Branch:** `codex/plugin-first-architecture`

## Objetivo

O CorreTop deve evoluir como uma plataforma modular. Páginas, drawers, chat,
dashboards, automações, IA, APIs e aplicativos devem consumir os mesmos domínios,
services e casos de uso.

Esta adoção será incremental. Não haverá reescrita geral: módulos existentes serão
migrados quando receberem novas entregas ou quando a duplicação de regras criar risco.

## Camadas

```text
Host (página, Workspace, drawer, widget ou API)
  ↓
Plugin de contexto
  ↓
Use case público do domínio
  ↓
Service de domínio
  ↓
Repository escopado
  ↓
Database
```

Hosts compõem a experiência. Plugins adaptam o contexto. Nenhum deles acessa banco,
faz query ou implementa regra de negócio.

## Domínios e contratos públicos

Cada domínio deve expor operações nomeadas, tipadas e testáveis fora da interface.

Exemplo de Leads:

```text
createLead()
updateLead()
archiveLead()
assignLead()
convertLead()
mergeLead()
```

Exemplo de Financeiro:

```text
getFinancialSummary()
getCommissionSchedule()
markCommissionPaid()
reverseCommissionPayment()
exportCommissionReport()
```

Todo use case deve obter o contexto confiável do servidor, validar entrada,
autorizar, aplicar tenant/filial/responsável, persistir, auditar quando necessário
e publicar eventos.

## Contrato de Plugin

Todo plugin deve declarar:

- `id` estável, nome, categoria e ícone;
- permissões e escopo necessário;
- tamanho mínimo e recomendado;
- modo de abertura;
- hosts compatíveis;
- eventos que escuta e publica;
- feature flag/capacidade que o controla;
- estado de prontidão e alternativa quando indisponível.

O registro de plugins apenas resolve composição, permissões, prontidão e contexto.
Ele não decide regra de domínio.

## Modos de uso

Todo domínio novo deve possuir:

### Modo completo

Rota própria com edição, filtros, histórico, auditoria, exportação autorizada,
configurações e todos os estados operacionais.

### Modo contextual

Plugin em Workspace, drawer, dialog, painel ou widget, preservando o contexto atual
e oferecendo link para o modo completo. O modo contextual chama exatamente os mesmos
use cases; nunca cria uma regra paralela.

## Comunicação por eventos

Módulos não devem depender diretamente uns dos outros para reagir a mudanças. O
primeiro barramento pode ser interno e síncrono após a transação, mas sua interface
deve permitir evolução para processamento assíncrono.

Eventos iniciais:

- `lead.created`, `lead.assigned`, `lead.converted`, `lead.status_changed`;
- `sale.created`;
- `commission.schedule_created`, `commission.paid`, `commission.payment_reversed`;
- `document.reviewed`, `task.completed`;
- `team.member_created`, `team.member_updated`.

Eventos carregam tenant, entidade, versão, timestamp e o mínimo de dados necessário.
PII desnecessária não deve ser publicada.

## Segurança e governança

Todo fluxo deve:

1. resolver sessão e tenant no servidor;
2. aplicar papel, filial e responsável;
3. validar entrada externa;
4. autorizar a operação;
5. executar o use case;
6. persistir via repository escopado;
7. registrar auditoria;
8. publicar evento;
9. revalidar as superfícies afetadas.

Toda capacidade deve ser editável, auditável e controlável por feature flag. O
Super-admin deve conseguir ativar/desativar a capacidade, acompanhar auditoria e
reativá-la sem apagar dados ou alterar código.

Quando uma capacidade estiver desativada, o host deve explicar o motivo e oferecer
alternativa; nunca exibir botão sem consequência.

## Perguntas obrigatórias antes do código

1. Qual é o domínio?
2. Quais use cases, services e repositories serão criados ou reutilizados?
3. A regra está fora de páginas e componentes?
4. Existe modo completo e contextual?
5. Quais plugins e hosts consumirão a capacidade?
6. Quais eventos serão publicados e escutados?
7. Pode ser reutilizada por IA, API e automação?
8. Como RBAC, tenant e filial serão aplicados no servidor?
9. Qual auditoria será gerada?
10. Qual feature flag e qual controle do Super-admin governam a capacidade?
11. Quais estados de prontidão, erro, vazio e permissão existem?
12. Como o domínio será testado sem depender da UI?

Se alguma resposta for “não”, a exceção precisa ser registrada antes da implementação.

## Migração do CorreTop

### Fase 1 — fundação

Criar contratos de host/plugin, tipos de eventos, convenções para services/use cases/
repositories, checklist arquitetural e registro de prontidão/feature flags.

### Fase 2 — domínio piloto

Usar **Lead** como piloto, pois já aparece em `/leads`, detalhe, `/conversas`, tarefas,
documentos e conversão. Extrair uma ação real, como `assignLead` ou `convertLead`,
e consumi-la em pelo menos dois hosts sem duplicar regra.

### Fase 3 — Financeiro

Migrar Financeiro depois do piloto por exigir escopo de Corretor, Gestor e Diretor,
auditoria, exportação e governança do Super-admin.

### Fase 4 — Workspace

Converter o Workspace em host puro, começando por Lead, Cotação, Documentos e
Financeiro. O Workspace não deve importar repositories nem services internos.

### Fase 5 — integrações

Conectar timeline, notificações e dashboards por eventos e preparar automações,
API pública, IA e processamento assíncrono quando houver necessidade real.

## Critérios de aceite

- Nenhum plugin acessa banco diretamente.
- Toda regra importante existe fora de páginas e componentes.
- O mesmo use case é utilizável por página e contexto contextual.
- RBAC, tenant e filial são verificados no servidor.
- Alterações relevantes geram auditoria.
- Feature flags desativam a capacidade sem apagar dados.
- O Super-admin vê e controla a disponibilidade.
- Eventos são versionados e não carregam PII desnecessária.
- Domínios possuem testes independentes da interface.
- A migração não exige reescrita total do CorreTop.
