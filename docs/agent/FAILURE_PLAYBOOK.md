# Playbook de Falhas

| Sinal | Ação imediata | Evidência mínima |
| --- | --- | --- |
| Type-check falha | isolar arquivo/erro, corrigir contrato | comando e erro resumido |
| Lint preexistente | separar regressão de baseline | arquivo e regra ESLint |
| Teste falha | reduzir para caso mínimo, preservar fixture | nome do teste e hipótese |
| Build falha | verificar ambiente, RSC/import e env não secreto | etapa e stack sem segredo |
| Tenant/perm. incerto | negar por padrão e revisar guard | caminho e cenário de acesso |
| Provider indisponível | não repetir envio; usar outbox/fallback aprovado | provider, idempotency key mascarada |

Ao bloquear, crie entrada em `reports/agent/failures/` e promova para `KNOWN_ISSUES.md` quando o problema for recorrente, sistêmico ou depender de terceiro.
