# 2026-09-15 — Rotação do QR ao abrir e cabeçalho do dashboard

## Problema

Ao reabrir o diálogo de conexão, o cliente podia continuar exibindo um QR
antigo enquanto a sessão remota já havia expirado ou falhado. A tela também não
usava o cabeçalho compartilhado no dashboard operacional.

## Correção

- Ao abrir o diálogo, sessões que ainda não estão prontas são iniciadas ou
  rotacionadas automaticamente. O estado local limpa o QR anterior antes da
  chamada, evitando reaproveitar uma imagem inválida.
- A ação **Invalidar e gerar QR** fica disponível em qualquer estado não
  conectado que tenha sessão. Ela usa a reconexão atômica do serviço WAHA para
  invalidar a sessão anterior e gerar um código novo.
- Falhas de início ou rotação passam a deixar a UI em estado de erro explícito,
  em vez de permanecer indefinidamente em “Conectando”.
- O dashboard operacional passou a usar `DashboardHeader`, preservando os
  componentes padronizados, o seletor de período e as ações de navegação no
  cabeçalho global.

## Operação

A rotação depende da rota `POST /internal/waha/connections/:id/reconnect` no
serviço Fastify. A branch de infraestrutura `codex/waha-stability` contém essa
implementação e precisa estar implantada no serviço API do Coolify para o fluxo
funcionar em produção.

## Validação

- `npm run type-check`: aprovado.
- `npm run build`: aprovado.
- Suíte API/WAHA: 76 testes aprovados.
- Suíte completa do frontend: 749/750 testes; a falha restante é o teste
  contratual legado de experiência Lite que procura o fluxo antigo do dashboard
  e não é causada por esta alteração.
