# Runtime de produção no Coolify — 2026-09-14

## Decisão registrada

O ambiente oficial não usa mais a Vercel. O frontend Next.js é executado pelo
Coolify em uma VPS e a API Fastify é executada pelo Coolify em uma VPS separada.
Integrações, webhooks, WAHA e workers ficam na API; o frontend acessa essa camada
por HTTPS autenticado.

## Fontes atualizadas

- `docs/adr/0045-coolify-vps-separated-runtime.md`
- `docs/decision-log.md` (DEC-099)
- `docs/adr/0037-waha-cadence-relay.md` (referência histórica marcada)
- `docs/architecture/CorreTop_Arquitetura_Desenvolvimento.md`
- `docs/architecture/system_design.md`
- `docs/implementations/index.md`

## Operação

Deploy, health check, observabilidade e rollback devem ser tratados por serviço.
Secrets permanecem no Coolify e não entram no repositório. A API deve ser validada
independentemente do frontend antes de liberar conexões WAHA ou webhooks.
