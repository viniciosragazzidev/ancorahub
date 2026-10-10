# Design System

Status: **ACTIVE** · versão `1.0.0` · fonte inicial: [`../../design.md`](../../design.md).

Este diretório transforma a referência visual em contrato operacional. Ele não altera automaticamente a UI existente e não contém regras de negócio.

## Leitura obrigatória

1. [DESIGN_CONTRACT.md](./DESIGN_CONTRACT.md)
2. [FOUNDATIONS.md](./FOUNDATIONS.md) e `tokens/`
3. [COMPONENT_RULES.md](./COMPONENT_RULES.md) e `components/`
4. [PAGE_PATTERNS.md](./PAGE_PATTERNS.md), [RESPONSIVE_RULES.md](./RESPONSIVE_RULES.md), [ACCESSIBILITY_RULES.md](./ACCESSIBILITY_RULES.md) e [MOTION_RULES.md](./MOTION_RULES.md)
5. [DESIGN_GAPS.md](./DESIGN_GAPS.md), quando não houver regra aplicável.

## Design system "Conversa" (modo Lite)

O modo Lite (corretor) usa o design system de conversa registrado em [lite/LITE_CHAT_DESIGN_SYSTEM.md](./lite/LITE_CHAT_DESIGN_SYSTEM.md) (tokens, movimento, navegação, componentes, padrões e guia de adoção 1:1 no modo diretor). Para telas do Lite e para a migração do modo normal, ele prevalece sobre os documentos abaixo.

## Vocabulário canônico

- **Foundation**: decisão transversal de cor, tipografia, espaço, raio, borda, sombra ou motion.
- **Token**: nome semântico que referencia uma foundation; valores sem evidência não podem ser inventados.
- **Primitive**: controle reutilizável sem contexto de negócio (Button, Input, Card).
- **Composite**: composição de primitives (FormField, DataTableToolbar).
- **Pattern**: arranjo reutilizável de página (List, Detail, Dashboard).
- **Feature**: comportamento de um domínio; não pertence a este design system.
- **Gap**: decisão necessária sem evidência suficiente; bloqueia criação de nova regra visual até ser resolvida.

## Escopo

O contrato governa superfícies de interface futuras e a evolução de primitives compartilhados. A implementação atual permanece fonte de comportamento até uma migração ser aprovada e rastreada.

Consulte [DESIGN_AUDIT.md](./DESIGN_AUDIT.md) antes de interpretar `design.md` como valor de produção.
