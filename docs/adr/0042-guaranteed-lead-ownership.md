# ADR-0042 — Titularidade provisória e autoridade única (DEC-097)

**Estado:** Aceita
**Data:** 2026-09-10
**Relacionadas:** DEC-049 (ofertas sequenciais), DEC-059 (fila geral), DEC-082 (Matriz), DEC-083 (janela comercial), DEC-027B (handoff SLA)

## Contexto

O motor de distribuição é resiliente (fila durável, lease, retry, re-seed a cada 2
minutos), porém vários caminhos legítimos terminavam em deferimento indefinido, com
o lead permanentemente sem corretor até intervenção humana:

- fila geral sem unidades permitidas na política;
- unidade pausada, `autoDistribute=false` ou Matriz;
- plantão ativo sem escalados;
- corretores elegíveis sem telefone corporativo;
- todos os elegíveis em capacidade máxima;
- ciclo de ofertas esgotado sem aceite;
- janela comercial fechada (noites/fins de semana).

Em produção, leads recém-cadastrados ficavam sem corretor por horas ou dias.

## Decisão

Introduzir **titularidade provisória** e centralizar toda decisão automática em
`src/features/lead-distribution`:

1. `processQueuedLead` aplica unidade, fila, plantão, disponibilidade, canal,
   política, cooldown, fila sem contato, carga, capacidade-alvo e ranking.
2. A oferta e o owner provisório são registrados sob row lock. A recusa, expiração
   ou SLA troca diretamente o owner para o próximo elegível.
3. Leads sem unidade são roteados para a unidade automática de menor carga, com
   desempate estável; uma unidade já definida nunca é trocada por fallback.
   Unidade operacional ativa com auto-distribuição desligada é reativada com
   auditoria; referência a fila inativa é reparada para a política global.
4. O processador roda 24/7: o gate de horário comercial foi removido do executor;
   a janela continua aplicada na outbox para envio de mensagens.
5. As tasks re-semeiam leads sem owner e owners provisórios vencidos, inclusive
   registros antigos com campos de qualificação nulos.

## Consequências

- **Positivas:** não existe estado intermediário visível sem corretor; todas as
  entradas e redistribuições compartilham a mesma regra; backlog é autorrecuperável.
- **Trade-offs:** capacidade é alvo de balanceamento, não bloqueio absoluto. Pausa,
  plantão e política continuam sendo critérios rígidos.
- **Governança:** toda troca provisória gera evento e auditoria; kill switch
  operacional permanece a fila em modo manual. Super-admin mantém
  `feature_lead_distribution_jobs_enabled` para pausar o motor inteiro.
- **Isolamento:** candidatos sempre consultados por `tenantId` da sessão; nenhum
  lead ou corretor cruza tenants.
