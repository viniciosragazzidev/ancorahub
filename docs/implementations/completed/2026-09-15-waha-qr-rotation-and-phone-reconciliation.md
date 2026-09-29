# 2026-09-15 — Rotação explícita do QR e reconciliação WAHA por assinante

## Problema

“Conectar novamente” reutilizava uma sessão em `WAITING_QR`; por isso o WAHA
mantinha o QR antigo até a expiração natural. A reconciliação de histórico também
consultava somente o telefone cadastrado, então um DDD desatualizado impedia que
mensagens móveis fossem associadas ao lead.

## Correção

- O Fastify ganhou `POST /internal/waha/connections/:id/reconnect`, serializado
  por sessão. Ele para, desconecta, remove e confirma a ausência da sessão antiga
  antes de criar/iniciar outra e retorna o QR novo quando já estiver disponível.
- “Conectar novamente” e “Gerar novo QR” usam essa operação única; o cliente
  limpa o QR anterior imediatamente e continua consultando o status até o
  pareamento.
- O cliente WAHA aceita QR em `data`, `qr` ou `base64` e lista chats de forma
  limitada para a reconciliação.
- A sincronização de mensagens seleciona chats pelo sufixo dos 9 últimos
  dígitos, permitindo DDD divergente sem alterar o telefone persistido.

## Segurança e operação

Todas as rotas permanecem protegidas pelo token interno, sem registrar QR,
telefone ou conteúdo de mensagens. A exclusão só é considerada concluída após
uma leitura de status que confirme que a sessão não existe; falhas deixam o
estado observável e não criam uma segunda sessão concorrente.

## Validação

- Suíte Fastify: 76 testes aprovados, incluindo concorrência da rotação e QR
  retornado pelo provider.
- `npm run type-check`: aprovado.
- Teste unitário de reconciliação: DDD diferente casa somente pelos 9 últimos
  dígitos e números de assinante diferentes não casam.

## Pendência de produção

É necessário redeploy do serviço `services/whatsapp-api` no Coolify/VPS e um
pareamento real para homologar o comportamento contra a instância WAHA de
produção.
