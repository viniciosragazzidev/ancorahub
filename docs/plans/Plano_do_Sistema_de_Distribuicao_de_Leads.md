# Plano do Sistema de Distribuição de Leads

## Objetivo

Criar um sistema de distribuição de leads escalável, auditável,
configurável e multi-tenant, permitindo que o Diretor controle toda a
operação, enquanto cada Unidade gerencia seus próprios corretores de
forma independente.

------------------------------------------------------------------------

# Princípios

-   Todo lead possui um ciclo de vida claro.
-   Toda ação gera auditoria.
-   Toda regra é configurável.
-   Nenhuma distribuição depende de código específico.
-   O sistema deve suportar diferentes estratégias de distribuição.
-   RBAC obrigatório em todas as operações.
-   Multi-tenant nativo.

------------------------------------------------------------------------

# Hierarquia Operacional

``` text
Super Admin
      ↓
Diretor
      ↓
Unidade
      ↓
Fila da Unidade
      ↓
Corretor
```

O sistema distribui **primeiro para filas**, nunca diretamente para
corretores.

------------------------------------------------------------------------

# Fluxo Geral

## 1. Entrada

Fontes:

-   CSV
-   Webhook
-   Landing Pages
-   API
-   WhatsApp
-   Integrações

Todos entram na **Inbox Geral**.

Estado inicial:

``` text
NOVO
```

------------------------------------------------------------------------

## 2. Inbox Geral do Diretor

O Diretor visualiza todos os leads da empresa.

Pode:

-   importar
-   editar
-   deduplicar
-   excluir
-   classificar
-   filtrar
-   distribuir
-   arquivar

Nenhuma unidade acessa essa fila.

------------------------------------------------------------------------

## 3. Distribuição para Unidade

O Diretor seleciona leads e envia para uma Unidade.

Exemplo:

``` text
200 Leads
↓
Unidade Centro
```

Novo estado:

``` text
AGUARDANDO DISTRIBUIÇÃO DA UNIDADE
```

A Unidade recebe uma notificação.

------------------------------------------------------------------------

# Filas

Cada Unidade possui uma ou mais filas.

Exemplos:

-   Geral
-   Plantão Manhã
-   Plantão Tarde
-   Premium
-   Empresarial
-   Renovação
-   Reativação

Cada fila possui estratégia própria.

------------------------------------------------------------------------

# Estratégias de Entrada

Como um lead chega à fila.

-   Manual
-   Calendário de Plantão
-   Origem
-   Região
-   Campanha
-   Produto
-   Especialidade
-   Híbrido

------------------------------------------------------------------------

# Calendário de Plantão

O Diretor define uma agenda.

Exemplo:

``` text
09:00–11:00 → Unidade Centro
11:00–13:00 → Unidade Barra
13:00–15:00 → Unidade Nova Iguaçu
```

Durante o período configurado todos os novos leads entram
automaticamente na fila da unidade escalada.

------------------------------------------------------------------------

# Gestão da Unidade

O Gestor administra apenas suas filas.

Pode:

-   distribuir
-   redistribuir
-   pausar
-   priorizar
-   mover
-   arquivar
-   acompanhar SLA
-   alterar capacidade
-   configurar estratégia da fila

------------------------------------------------------------------------

# Distribuição para Corretores

Cada fila define sua estratégia.

Estratégias suportadas:

-   Round Robin
-   Manual
-   Capacidade
-   Especialidade
-   Plantão interno
-   Equipe
-   Híbrida

Todas configuráveis.

------------------------------------------------------------------------

# Owner

Após distribuição:

-   o corretor torna-se Owner;
-   novas mensagens retornam sempre para ele;
-   troca exige fluxo formal;
-   histórico nunca é perdido.

------------------------------------------------------------------------

# Capacidade

Cada corretor possui capacidade operacional configurável.

Quando atingir o limite:

-   continua atendendo os leads atuais;
-   deixa de receber novos;
-   o algoritmo procura outro elegível.

------------------------------------------------------------------------

# Recusas

O corretor pode recusar.

Obrigatório:

-   motivo;
-   auditoria;
-   retorno para fila;
-   notificação do gestor.

------------------------------------------------------------------------

# Transferências

Permitidas conforme RBAC.

Sempre registrando:

-   responsável anterior;
-   novo responsável;
-   motivo;
-   data;
-   usuário.

------------------------------------------------------------------------

# SLA

Motor configurável.

Suporta:

-   primeira resposta
-   continuidade
-   escalonamento
-   redistribuição automática
-   horários comerciais
-   exceções

------------------------------------------------------------------------

# Motor de Estratégias

Toda distribuição passa por um único motor.

Fluxo:

``` text
Lead recebido
↓
Regras da Empresa
↓
Fila da Unidade
↓
Regras da Fila
↓
Corretor
```

Evitar condicionais espalhadas.

Cada estratégia implementa um contrato comum.

------------------------------------------------------------------------

# Estados do Lead

``` text
Novo
↓
Inbox Geral
↓
Aguardando Unidade
↓
Fila da Unidade
↓
Aguardando Corretor
↓
Em Atendimento
↓
Convertido
↓
Perdido
↓
Arquivado
```

------------------------------------------------------------------------

# Permissões

## Diretor

-   visão global
-   todas as unidades
-   distribuição geral
-   calendário de plantão
-   filas
-   gestores
-   configurações

## Gestor

-   apenas sua unidade
-   filas da unidade
-   distribuição interna
-   capacidade
-   SLA
-   métricas

## Corretor

-   apenas seus leads
-   atendimento
-   recusa
-   notas
-   tarefas

------------------------------------------------------------------------

# Auditoria

Registrar:

-   entrada do lead
-   importação
-   webhook
-   distribuição
-   redistribuição
-   recusa
-   transferência
-   alteração de owner
-   mudança de fila
-   alteração de estratégia
-   alteração de capacidade
-   mudança de plantão
-   SLA
-   ações administrativas

Nunca excluir histórico.

------------------------------------------------------------------------

# Super Admin

Recebe logs globais:

-   falhas
-   webhooks
-   integrações
-   alterações críticas
-   erros
-   eventos de segurança
-   auditorias relevantes

Sem acessar dados comerciais quando não autorizado.

------------------------------------------------------------------------

# Arquitetura Recomendada

``` text
Lead Inbox
      ↓
Strategy Engine
      ↓
Queues
      ↓
Assignment Engine
      ↓
Conversation Workspace
```

Cada componente deve ser desacoplado, reutilizável e preparado para API,
automações, IA e plugins.

------------------------------------------------------------------------

# Critérios de Aceite

-   Inbox geral funcional.
-   Distribuição Diretor → Unidade.
-   Filas por Unidade.
-   Estratégias configuráveis.
-   Calendário de Plantão.
-   Distribuição automática para corretores.
-   Distribuição manual.
-   Owner persistente.
-   SLA.
-   Auditoria completa.
-   RBAC.
-   Multi-tenant.
-   Event Bus.
-   Plugin First.
-   Sem duplicação de regras de negócio.
