# Conexão WAHA Lite com confirmação imediata

**Data:** 2026-08-28  
**Estado:** em validação

## Objetivo

Fazer o corretor em modo Lite receber confirmação visual rápida e confiável após
parear seu WhatsApp, sem depender de recarregar toda a área de conversas.

## Escopo

- Normalizar os estados de sessão na fronteira Fastify e no CRM.
- Publicar um sinal opaco, escopado por tenant e corretor, quando a sessão muda.
- Atualizar o estado local da tela Lite e exibir confirmação por toast.
- Usar reconciliação leve apenas enquanto uma sessão está pareando; não manter
  `router.refresh()` periódico para toda a área de conversas.
- Remover consultas redundantes antes de iniciar o pareamento e a busca duplicada
  de QR logo após a primeira.

## Segurança e governança

O sinal não contém telefone, QR, mensagem, tenant ou identificador de sessão. O
navegador relê a conexão por Server Action autenticada e limitada ao próprio corretor.
A capacidade continua sob o kill switch existente `feature_waha_connections_enabled`.

## Aceite

1. Ao WAHA confirmar conexão, o Lite mostra toast e libera a carteira sem F5.
2. Sem webhook, uma sessão em pareamento é reconciliada em até 2 segundos enquanto
   a aba estiver visível.
3. O status `CONNECTED`, `WORKING`, `READY`, `AUTHENTICATED`, `OPEN` e `ONLINE`
   é interpretado como conectado.
4. Não há polling contínuo nem recarga integral da lista após a conexão estabilizar.

## Rollback

Remover o domínio `whatsapp_connection` e restaurar o polling anterior. Não há
migração, alteração de credenciais nem modificação de dados de negócio.
