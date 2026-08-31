# Confiabilidade da desconexão WAHA Lite

**Estado:** em implementação
**Data:** 2026-08-31

## Objetivo

Corrigir a desconexão do WhatsApp pessoal do corretor sem simular sucesso local: o
estado do CRM só muda depois da confirmação do WAHA.

## Evidência inicial

- O Lite usa `resetWhatsAppSessionAction`, que chama `POST
  /internal/waha/connections/:id/disconnect`.
- O serviço executa `stop`, `logout` e `delete` em sequência, cada etapa com timeout
  de até cinco segundos.
- A chamada CRM para a API interna expirava em 15 segundos e o endpoint descartava o
  código normalizado do WAHA, reduzindo erros distintos a `WAHA_UNAVAILABLE`.
- O fallback de conexões corporativas usava `DELETE /internal/waha/connections/:id`,
  embora o Fastify exponha a operação canônica como `POST .../:id/disconnect`.

## Escopo

1. Preservar os códigos seguros do provedor através da API interna e da Server Action.
2. Permitir estados de limpeza já encerrados para `stop` e `logout`, sem mascarar
   falhas de rede, autenticação ou remoção.
3. Dar à operação de desconexão uma janela compatível com as três etapas, mantendo os
   demais requests curtos.
4. Cobrir o ciclo com testes de cliente e de rota.
5. Alinhar o fallback corporativo de status e desconexão às rotas reais do Fastify.

## Fora de escopo

- Alterar credenciais, variáveis de ambiente, sessões de produção ou regras de
  isolamento de conversas.
- Fazer a interface declarar desconexão antes de a API interna confirmar a operação.
