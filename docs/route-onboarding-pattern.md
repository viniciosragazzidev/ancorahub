# Onboarding contextual por rota

O CorreTop apresenta uma introdução curta na primeira visita de cada usuário a uma rota autenticada. O comportamento é persistido por `tenant_id`, `user_id` e `route_key` na tabela `route_onboarding_progress`, portanto não depende de localStorage ou de um dispositivo específico.

## Contrato

- O catálogo fica em `src/features/onboarding/route-onboarding.ts`.
- O host é `src/app/(dashboard)/layout.tsx`; as páginas não implementam a regra.
- O componente reutilizável é `RouteOnboardingDialog`.
- Conclusão ou dispensa é registrada por Server Action autenticada.
- A capacidade global é controlada por `feature_route_onboarding_enabled`.
- O Super-admin pode buscar por nome, e-mail ou ID em `/super-admin/onboarding` e usar `Ativar e reiniciar`.
- Cada reset insere ou reabre todas as rotas do usuário na corretora selecionada e registra `route_onboarding.reset` em `platform_audit_logs`.

## Conteúdo e motion

Cada entrada declara título, descrição, ícone e dica operacional. O dialog usa os componentes compartilhados de dialog e button, overlay escuro com blur, entrada escalonada de conteúdo e um movimento ambiental discreto. A regra `prefers-reduced-motion` remove as animações sem remover informação ou ação.

Ao criar uma nova rota, adicione uma entrada estável ao catálogo, mantenha copy específica para o papel operacional e valide a rota no servidor pelo catálogo antes de ler ou gravar progresso.
