> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Interaction Contract

- Dialog: Escape e overlay fecham quando a ação não for destrutiva; foco retorna ao trigger.
- Drawer: detalhe/edição contextual; mesma regra de foco, Escape e scroll lock da primitive.
- Toast: sucesso/erro/aviso/info usa o mecanismo central; mutação confirma resultado e atualiza contexto sem duplicar feedback.
- Empty: ícone opcional, título, motivo, próxima ação opcional.
- Loading: skeleton estrutural quando a forma do conteúdo é conhecida; não usar spinner de página inteira como fallback universal.
- Error/permission: mesmo container do conteúdo, causa clara, recuperação possível e sem depender apenas de cor.
