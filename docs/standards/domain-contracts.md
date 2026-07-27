# Contratos de domínio e invariantes

Este documento complementa `CONTEXT.md`. `CONTEXT.md` define o vocabulário; este arquivo define como validar mudanças sem alterar a linguagem do negócio.

## Entidades e limites

| Entidade | Dono do ciclo de vida | Escopo mínimo | Regra principal |
|---|---|---|---|
| Tenant/corretora | plataforma | `tenantId` | Nunca é escolhido pelo cliente |
| Unidade/filial | gestão da corretora | `tenantId`, quando aplicável `branchId` | A distribuição só usa unidade ativa e apta |
| Usuário/membership | administração | tenant + identidade | Papel vem da sessão confiável |
| Lead | operação comercial | tenant + unidade + responsável | Um lead tem estado, origem e histórico auditável |
| Beneficiário | atendimento | tenant + lead | Há exatamente um titular por lead |
| Cotação | corretor/gestão | tenant + lead | Versão histórica; não editar fatos já compartilhados |
| Documento | atendimento/documentos | tenant + lead + beneficiário opcional | Storage privado; acesso sempre autorizado |
| Venda | operação/pós-venda | tenant + lead | Conversão só após confirmação válida |
| Cliente ativo | pós-venda | tenant + venda | Só nasce de venda aprovada |
| Canal externo | integração | tenant + unidade opcional | Segredo nunca retorna ao navegador |

## Invariantes obrigatórias

1. Toda leitura e mutação valida `tenantId` do contexto do servidor.
2. Unidade, responsável e papel são resolvidos pelo servidor; valores enviados pelo browser são apenas intenção e nunca autoridade.
3. Um lead expirado não permanece na fila operacional do corretor quando a regra de SLA o torna inelegível.
4. A transição de status deve validar o estado anterior, a permissão, os pré-requisitos e registrar auditoria.
5. `converted` exige confirmação de venda válida; falhas deixam o lead no estado anterior e explicam a pendência.
6. Um lead deve ter um único titular; dependentes são adicionais e não podem substituir o titular sem transação explícita.
7. Checklist por beneficiário é persistente, idempotente e não apaga evidência histórica ao ser sincronizado.
8. Documentos rejeitados, excluídos logicamente ou substituídos permanecem rastreáveis quando a retenção legal exigir.
9. Cotações compartilhadas são imutáveis; uma nova condição cria uma nova versão.
10. Jobs são idempotentes: reprocessar o mesmo evento não cria lead, tarefa, notificação ou auditoria duplicados.
11. Webhooks validam assinatura/challenge, deduplicam por identificador externo e respondem rápido; processamento pesado é separado quando necessário.
12. Todo evento externo é associado a tenant/unidade por credencial ou identificador validado, nunca por `tenant_id` do payload.

## Estados

Cada estado deve documentar: entrada permitida, ação responsável, saída permitida, timeout, reversão e auditoria.

```text
Lead: new → distributed → in_contact → quote_sent → negotiation
     → documentation_pending → under_analysis → converted
     └→ lost
```

Estados adicionais ou renomeações exigem atualização de `docs/business-rules.md`, testes de transição e uma decisão registrada.

## Contrato de caso de uso

Todo caso de uso deve receber uma entrada tipada e devolver um resultado tipado, sem resposta HTTP ou JSX:

```ts
type UseCaseResult<T> =
  | { ok: true; value: T; audit: AuditIntent }
  | { ok: false; code: string; message: string; retryable: boolean };
```

O caso de uso deve:

1. receber o contexto confiável e dependências/adapters;
2. validar invariantes;
3. executar a transação necessária;
4. emitir intenção de auditoria com PII minimizada;
5. devolver um resultado seguro para a camada chamadora.

## Conflitos e decisões

Quando código e domínio divergirem, não “corrigir” silenciosamente. Registrar:

- comportamento atual observado;
- regra pretendida;
- impacto para dados existentes;
- estratégia de migração e rollback;
- testes que comprovam a nova regra.
