> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Regras de Patterns

Patterns são composições reutilizáveis entre primitives e features. Eles definem anatomia, hierarquia e estados; não consultam dados, não recebem autoridade de tenant e não contêm regra de negócio.

1. Cada rota nova ou refatorada declara um blueprint no registry antes da implementação.
2. Um pattern usa primitives canônicas e seus tokens; não cria versões locais de Button, Card, Field, overlay ou feedback.
3. A feature mantém dados, permissões, queries, mutações e conteúdo de domínio.
4. Toda composição cobre loading, vazio, erro, permissão e indisponibilidade quando aplicáveis.
5. Ação primária, contexto e próximo passo permanecem visíveis sem depender de cor ou animação.

Consulte `patterns/` para a anatomia de cada blueprint e `PATTERN_UX_RULES.md` para decisões de densidade, feedback e recuperação.
