# Pausa reversível do atendimento interno do corretor

**Data:** 2026-08-24  
**Estado:** em validação

> **Atualização 03/09:** a área Lite deixou de ser atendimento interno. Com o
> recurso ativo, ela exibe apenas insights de conversas de leads/clientes atribuídos;
> com o recurso desativado, a sincronização e a área são pausadas sem desconectar a
> sessão. A resposta continua sendo feita no WhatsApp externo.

## Objetivo

Pausar temporariamente a superfície interna de WhatsApp do corretor sem apagar
sessões, mensagens ou conexões. O atalho de WhatsApp do lead deve abrir o aplicativo
ou WhatsApp Web pelo endereço `wa.me`.

## Decisão e escopo

- A autoridade é o kill switch existente `feature_waha_connections_enabled`. O valor
  `false` bloqueia a rota Lite, os envios internos do corretor e a entrada de
  navegação; reativar o mesmo controle restaura o comportamento sem migração.
- `/conversas/broker` e o redirecionamento Lite em `/conversas` voltam para
  `/minha-fila` durante a pausa. O corretor nunca é redirecionado à central geral,
  que é uma superfície de gestão.
- O botão **WhatsApp** do detalhe do lead sempre usa `https://wa.me/<telefone>` em
  nova aba. Não existe envio interno pela sessão WAHA do corretor.
- A barra inferior Lite não apresenta **Conversas** enquanto a área interna está
  pausada. Nenhuma sessão WAHA é desconectada e nenhum dado é excluído.

## Segurança e reversão

O telefone continua aparecendo apenas quando a autorização de dados pessoais já foi
validada no servidor. O destino é derivado do telefone do lead já autorizado, sem
identificador de tenant vindo do navegador. O controle é global e sua alteração é
registrada em `platform_audit_logs` pela ação de Super-admin existente.

Rollback: reativar `feature_waha_connections_enabled`; não há alteração de schema,
inbound, webhooks, VPS ou credenciais.
