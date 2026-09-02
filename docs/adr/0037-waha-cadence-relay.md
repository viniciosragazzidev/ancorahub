# ADR-0037 — Cadência WAHA por relay isolado

**Estado:** Aceita em 2026-08-04

O AncoraHub permanece na Vercel. O WAHA roda em uma VPS exclusiva e é acessado por
uma API privada autenticada por HMAC, timestamp, nonce e chave de idempotência. A VPS
não recebe acesso direto ao banco nem às credenciais do canal oficial Meta.

Os números WAHA pertencem à frota central da Ancora e são administrados apenas pelo
Super-admin. Cadências são criadas e publicadas por Diretores no próprio tenant. O
canal Meta Cloud continua sendo o canal oficial para conversas com leads e clientes.
Excepcionalmente, o Diretor pode escolher um número WAHA de escopo da empresa como
número oficial de avisos internos a corretores: o envio pode priorizar a Meta e usar
WAHA somente após falha confirmada, ou seguir diretamente por WAHA. Esta contingência
não se aplica a atendimento, qualificação, campanhas ou mensagens de leads.

Envios WAHA são persistidos em uma outbox antes de chamar a VPS. O relay e o CRM
deduplicam requisições e webhooks. Uma resposta inbound pode habilitar a IA apenas se
as flags globais estiverem ativas; a IA mantém a autonomia limitada da DEC-054.

Qualquer contato do CRM pode entrar em uma cadência publicada, mas descadastro global
é obrigatório, conteúdo sensível não pode entrar no texto e toda entrega deve manter
tenant, cadência, versão, número e ator de publicação em auditoria.
