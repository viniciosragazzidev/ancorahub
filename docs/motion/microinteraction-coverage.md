# Matriz de Cobertura de Microinterações do AncoraHub

Este documento registra a auditoria e o status de cobertura do **Motion Design System** em todos os componentes e rotas do produto.

---

## 1. Inventário por Componente

| Componente | Estado Hover | Estado Press | Estado Loading | Estado Success | Reduced Motion | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Button** | `hover:brightness-95` | `active:scale-[0.97]` | Spinner + "Salvando..." | Confirm 1s | Opacidade/Cor | ✅ Concluído |
| **IconButton** | `hover:bg-muted` | `active:scale-[0.97]` | Rotating Icon | State Swap | Color Only | ✅ Concluído |
| **Select / Combobox** | Border highlight | Focus ring | Loading option | Checkmark fade | Fade puramente | ✅ Concluído |
| **Tabs** | Color swap | Click trigger | Tab skeleton | Layout Indicator | Sem animação deslizante | ✅ Concluído |
| **Sidebar Items** | Highlight background | Tactile press | - | `layoutId` pill | Static highlight | ✅ Concluído |
| **Dialog / Modal** | - | - | Backdrop loader | Success state | Direct mount | ✅ Concluído |
| **Drawer / Sheet** | - | - | Drawer loader | Action complete | Fade em vez de slide | ✅ Concluído |
| **Tooltip / Popover** | Hover trigger | Click trigger | - | - | Instant popup | ✅ Concluído |
| **Kanban Card** | Lift scale 1.02 | Drag active | Dropping shadow | Column snap | Position snap | ✅ Concluído |
| **Checkbox / Task** | Border hover | Micro-press | - | Strikethrough | Instant check | ✅ Concluído |

---

## 2. Inventário por Rota / Módulo

| Rota | Microinterações Ativas | Skeletons / Loading | Status |
| :--- | :--- | :--- | :--- |
| `/dashboard` | Metric Card hover, Donut animation, Header actions | Metric Skeletons | ✅ Concluído |
| `/leads` | Kanban drag/drop, Filter chips slide, Status badge crossfade | Lead Table Skeletons | ✅ Concluído |
| `/vendas` | Proposal status badge, Action button press, Modal scaleFade | Proposal Skeletons | ✅ Concluído |
| `/qualificacao` | IA status indicator, Follow-up rules toggle, Simulator reset | Qualification Skeletons | ✅ Concluído |
| `/settings` | Tab layoutId animation, Auto-save feedback, Switch slide | Settings Card Skeletons | ✅ Concluído |
| `/guia` | Glossary term tooltip, Drawer entrance, Search highlight | Help Skeletons | ✅ Concluído |
| `/internal/design-system/motion` | Motion Playground completo com animações ativas | Client Rendering | ✅ Concluído |

---

## 3. Critérios de Aceite

- [x] Nenhuma duração ou easing arbitrários inline.
- [x] Suporte nativo a `prefers-reduced-motion: reduce`.
- [x] Zero Layout Shift (CLS) durante estados de carregamento.
- [x] Feedback tátil consistente em todos os botões (`active:scale-[0.97]`).
- [x] Testado via `npm run agent:verify -- --level fast`.
