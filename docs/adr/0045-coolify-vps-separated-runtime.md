# ADR-0045 — Produção no Coolify com frontend e API separados

**Status:** Aceita
**Data:** 2026-09-14

## Contexto

O ambiente de produção deixou de usar a Vercel. O frontend do AncoraHub e a API
que executa integrações, webhooks e jobs precisam ter ciclos de deploy, limites e
observabilidade independentes. O serviço WAHA já possui uma fronteira Fastify
separada e não deve depender de um runtime serverless para operar.

## Decisão

- O frontend Next.js é publicado pelo Coolify em uma VPS própria de frontend.
- A API Fastify (`services/whatsapp-api`) é publicada pelo Coolify em uma VPS
  separada da frontend.
- A comunicação frontend/API ocorre somente por HTTPS privado/autenticado; tokens
  internos ficam configurados como secrets no serviço correspondente do Coolify.
- Webhooks, integrações WAHA/Meta e workers agendados pertencem ao serviço de API;
  o frontend não executa essas responsabilidades por fallback.
- O deploy oficial parte do Git e deve registrar a versão da imagem, health checks,
  logs e rollback de cada serviço separadamente.
- Referências a Vercel em documentos anteriores são históricas e não descrevem o
  ambiente de produção atual.

## Alternativas consideradas

- Manter frontend e API juntos na Vercel: rejeitado por acoplamento de ciclo de
  deploy e incompatibilidade com workers persistentes.
- Hospedar frontend e API na mesma VPS: rejeitado para preservar isolamento de
  falhas e permitir escala independente.
- Usar um provedor diferente do Coolify: não escolhido nesta etapa para manter o
  fluxo operacional já adotado na VPS.

## Consequências

- Todo novo endpoint usado pelo frontend precisa apontar para a base da API e
  validar autenticação, CORS/origem confiável e timeout.
- O pipeline deve validar e publicar os dois serviços, ou declarar explicitamente
  qual deles foi alterado.
- Diagnósticos devem distinguir falha do frontend, da API e do provedor externo;
  nenhum health check pode mascarar indisponibilidade da outra camada.
- Rollback é independente: reverter o frontend não deve apagar ou reiniciar
  sessões WAHA da API.
