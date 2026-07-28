# Arquitetura de Referência

```text
App Router / API / Extension host
        -> domínio público (use case ou service)
        -> autorização + tenant/unidade/carteira
        -> repository escopado / transação
        -> Postgres, outbox ou integração privada
        -> auditoria e evento mínimo
```

- `src/app`: rotas, composição e Route Handlers; não concentra regra de negócio.
- `src/features`: domínios, schemas, ações, serviços, queries e testes.
- `src/shared` e `src/utils`: infraestrutura e utilitários reutilizáveis; não recebem
  regra comercial específica.
- `src/components`: primitives e composição visual sem acesso direto ao banco.
- `services/whatsapp-api`: fronteira separada para chamadas que usam credenciais Meta.
- `apps/browser-extension`: consumidor externo autorizado; nunca replica autorização.

Server Components são o padrão. Uma fronteira `use client` só existe para estado,
efeitos ou APIs do navegador e deve ser a menor possível. Route Handlers validam input,
autenticam ou verificam assinatura, derivam o escopo confiável e chamam o domínio.

Direção detalhada: `docs/plugin-first-architecture.md` e decisões em
`docs/decision-log.md`.
