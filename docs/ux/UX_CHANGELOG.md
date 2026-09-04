# Histórico de Alterações de UX/UI (UX Changelog)

> **Documento Vivo**: `docs/ux/UX_CHANGELOG.md`  
> **Framework de Governança**: `UX-GOV-1`  
> **Fonte de Verdade**: `docs/ux/UX_REDESIGN_CONTRACT.md`  

Este documento registra cronologicamente todas as alterações de UX/UI, estrutura de páginas, componentes e navegação realizadas no CRM Âncora.

---

## 2026-09-04 — / (Global) & /conversas

### Problema
1. A sidebar textual antiga possuía 13 itens espalhados em 4 seções, ocupando 240px de largura horizontal e gerando sobrecarga cognitiva.
2. Na rota `/conversas`, o cabeçalho (`DashboardHeader`) e o topo dos filtros estavam sendo cortados/empurrados para fora da viewport devido a um overflow de altura fixa (`h-[calc(100dvh-...)]`) somado ao padding do shell.
3. O contraste de ícones e legendas da nova sidebar em modo dark/light estava com visibilidade reduzida.

### Objetivo
1. Transformar a sidebar em uma **Vertical Rail** compacta (80px / 5rem) com tiles canônicos (ícone no topo + legenda embaixo).
2. Ajustar o contraste para alta definição (`text-slate-200`, active `text-emerald-300` com fundo `#183134`).
3. Corrigir o layout de `/conversas` para ocupar `100%` da altura útil sem scroll externo na página principal.

### Antes
- Sidebar com 240px de largura e listas textuais longas.
- `/conversas` com scroll interno duplo que fazia o cabeçalho sumir ao interagir com a lista de chats.
- Ícones da rail pouco visíveis em telas escuras.

### Depois
- Sidebar compacta de 80px com tiles ergonômicos e tooltips laterais (`src/components/corretop-sidebar.tsx`).
- Rota `/conversas` com container `flex h-dvh min-h-0 flex-col overflow-hidden` e cada painel interno com seu próprio `ScrollArea` independente.
- Ícones com contraste cristalino, active state com glow esmeralda e WhatsApp com badge BETA.

### Componentes reutilizados
- `<Sidebar />`, `<SidebarHeader />`, `<SidebarContent />`, `<SidebarFooter />` de `@/components/ui/sidebar`.
- `<Tooltip />`, `<TooltipTrigger />`, `<TooltipContent />` de `@/components/ui/tooltip`.
- `<DropdownMenu />`, `<DropdownMenuTrigger />`, `<DropdownMenuContent />` de `@/components/ui/dropdown-menu`.
- `<DashboardHeader />` de `@/components/dashboard-header`.
- `<ConversationsWorkspace />` de `@/app/(dashboard)/conversas/conversations-workspace`.

### Componentes alterados
- `src/components/corretop-sidebar.tsx`: Reescrito para o padrão vertical rail com tiles canônicos e alto contraste.
- `src/components/app-shell.tsx`: Ajustado `--sidebar-width` para `5rem` no CRM padrão e `16rem` no Financeiro.
- `src/app/(dashboard)/conversas/page.tsx`: Corrigido container raiz para `flex h-dvh min-h-0 flex-col overflow-hidden`.
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`: Ajustado container raiz para `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card`.
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx`: Ajustado container raiz para `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card`.

### Funcionalidades movidas
- Nenhuma funcionalidade removida. Todos os links de navegação continuam acessíveis diretamente na rail ou no menu de perfil do rodapé.

### Funcionalidades preservadas
- 100% de preservação de rotas, permissões por cargo, super-admin switcher, plantão ao vivo com pulse em tempo real, drawer de IA (Ctrl+J), logout seguro e alternância de modo Full/Lite.

### Responsive
- Desktop/Notebook: Rail fixa de 80px com tooltips ao passar o mouse.
- Mobile (<560px): `MobileBottomNav` preservado com 4 ações prioritárias e gatilho "Mais".
- Drawer de conversas mobile: Sheet lateral deslizante com botão de retorno.

### Accessibility
- Suporte a navegação por teclado (`Tab`, `Enter`, `Escape`), atributos WAI-ARIA `aria-label`, foco visível com anéis de foco, `TooltipProvider` com delay de 150ms e sem aninhamento inválido de `<button>` dentro de `<button>`.

### Visual QA
- [x] Page padding consistente? Sim.
- [x] Título e header visíveis sem corte no topo? Sim.
- [x] Ícones com contraste e tamanho corretos (size-6)? Sim.
- [x] Texto secundário e legendas legíveis? Sim.
- [x] Sem bugs de scroll externo? Sim.

---

## 2026-09-04 — /unidades (Piloto UX-1B)

### Problema
A listagem de filiais em `src/features/branches/components/branches-manager.tsx` usava tabelas sem container estrutural padronizado, badges manuais sem tokens semânticos e não possuía estado vazio canônico quando não haviam filiais cadastradas.

### Objetivo
Validar a biblioteca canônica de `src/components/foundations/` em uma página piloto de baixo risco.

### Antes
- Tabela isolada em card cru.
- Badges com classes Tailwind ad-hoc.
- Ausência de empty state semântico.

### Depois
- Encapsulado em `<Section title="Filiais da corretora" description="..." actions={<CreateBranchSheet />} />`.
- Status unificados com `<StatusBadge label="Ativa" tone="success" dot />`.
- `<EmptyState type="EMPTY_DATA" />` para lista vazia com instrução clara.

### Componentes reutilizados
- `<Section />`, `<StatusBadge />`, `<EmptyState />` de `src/components/foundations/`.

### Funcionalidades preservadas
- 100% de formulários server actions (`useActionState`), feedbacks por toast, métricas de equipe com sparklines (`StatCard`) e toggles de recebimento de leads.

### Visual QA
- [x] Espaçamento vertical e padding de tabela padronizados.
- [x] Status visualmente coerentes com os 5 tons semânticos.
