# Fundação CRM → VPS: health observável

## Escopo desta etapa

Esta entrega cria somente a primeira conexão server-side entre o CRM hospedado na
Vercel e a VPS: `GET ${VPS_API_URL}/health`. Nenhuma rota de negócio, credencial de
canal, query de banco, fila, webhook, lead, Meta ou WhatsApp foi movida.

## Contrato e segurança

- `VPS_API_URL` é variável privada do servidor e deve usar HTTPS.
- Configure `VPS_API_URL=https://api.crm.ancorasaude.cloud` em `.env.local` e nos
  ambientes correspondentes da Vercel; arquivos `.env*` não entram no repositório.
- `src/lib/server/vps-api.ts` é `server-only`, remove barras finais e chama somente
  o origin configurado em `/health`.
- O cliente usa `no-store`, timeout de 7 segundos e valida estritamente a resposta
  `{ status: "ok", service, timestamp }`.
- Falhas retornam somente códigos estáveis (`timeout`, `http_error`,
  `invalid_response`, `network_error`); URL, payload e detalhes de infraestrutura
  não chegam à interface.
- Logs estruturados registram resultado, código de erro e latência sem segredos ou
  dados pessoais.
- `GET /api/internal/vps-health` exige sessão de Super-admin e devolve somente um
  contrato sanitizado. Ele serve para validar Next.js → VPS, sem expor a VPS ao
  navegador.

## Preparação da etapa 18.4

- `VPS_INTERNAL_API_TOKEN` permanece privado tanto na Vercel quanto na VPS. Nenhum
  token foi gerado, salvo ou registrado por esta entrega.
- `getVpsInternalPing()` está preparado para enviar `Authorization: Bearer` apenas no
  servidor e não chama a VPS se a configuração estiver ausente.
- A fonte do serviço `corretop-api` implantado na VPS não está neste repositório. A
  proteção de `GET /internal/ping` deve ser instalada e validada no repositório/acesso
  da VPS antes de ativar o token ou declarar a etapa 18.4 concluída.

## Observabilidade

`/super-dev/integridade`, a área de Infra do Super Dev, exibe o cartão VPS para
administradores da plataforma, com estado, Fastify, horário de checagem e latência.
Esse é um diagnóstico de leitura; não cria uma nova permissão, mutação ou dependência
operacional.

## Próximas etapas explícitas

1. autenticação interna Next.js → VPS;
2. `GET /internal/infra/status` autenticado na VPS;
3. health de Redis/BullMQ pelo backend;
4. primeira rota READ não crítica e, somente depois, operação assíncrona.

## Validação

- Testes unitários para resposta válida, timeout, configuração ausente, Bearer
  server-side e recusa do diagnóstico sem privilégio de plataforma.
- Health externo confirmado com `HTTP 200` da VPS.
- Type-check, lint, testes e build de produção pendentes da verificação final.
