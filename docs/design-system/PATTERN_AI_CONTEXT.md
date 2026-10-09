> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Contexto para Agentes de UI

Antes de alterar uma página, um agente deve carregar: `DESIGN_CONTRACT.md`, foundations aplicáveis, o blueprint da rota, `PATTERN_UX_RULES.md`, `PATTERN_INTERACTION_CONTRACT.md` e o registro `.agent/pattern-registry.json`.

O agente deve declarar o blueprint, preservar regras de negócio fora da camada visual, reutilizar primitives e documentar qualquer exceção. Não deve migrar tela apenas para satisfazer o registry: a migração exige tarefa e validação próprias.
