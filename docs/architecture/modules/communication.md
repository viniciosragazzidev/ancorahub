# Módulo Comunicação

Centraliza canais oficiais, templates, outbox, callbacks de entrega e notificações. O canal é resolvido por identificador externo confiável; tokens permanecem cifrados no servidor. Envio de negócio é persistido antes de execução e pode ser governado por feature flag global/tenant.

Consulte `src/features/communication-channels`, `src/features/notifications`, DEC-033, DEC-045 e BR-029, BR-050 a BR-060.
