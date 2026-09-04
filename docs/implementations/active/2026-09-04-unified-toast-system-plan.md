# Plano: Sistema Unificado de Toast — Auditoria e Estratégia de Consolidação

**Data:** 2026-09-04  
**Status:** PLANO (pendente de aprovação)  
**Etapa UX aplicável:** Transição entre UX-1B/UX-1C (foundations + sidebar) — infraestrutura transversal de feedback visual  

---

## 1. Diagnóstico Atual

### 1.1 Mapeamento de importações

O projeto possui **duas fontes de importação** de toast que coexistem:

| Padrão de import | Arquivos | Caminho |
|---|---|---|
| `import { toast } from "sonner"` | **~131 arquivos** | Direto do pacote npm, sem wrapper |
| `import { toast } from "@/components/ui/sonner"` | **4 arquivos** | Wrapper customizado com `AnimatedToast` |

### 1.2 Arquivos que usam o wrapper customizado (caminho correto)

1. `src/components/notifications/incoming-lead-card.tsx`
2. `src/features/leads/components/feedback-toast-handler.tsx`
3. `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx`
4. `src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx`

### 1.3 Arquivos com `toast.custom()` — UI inline completamente diferente

Estes dois componentes criam toasts com markup 100% customizado, ignorando totalmente o sistema visual compartilhado:

| Componente | Descrição do problema |
|---|---|
| `src/features/leads/components/feedback-toast-handler.tsx` | Constrói um card inteiro com HTML inline, fundo `bg-card/95`, botões próprios, labels fixos. Não usa `AnimatedToast`. |
| `src/components/notifications/incoming-lead-card.tsx` | Constrói card com header customizado, ícones inline, botão CTA Link. Não usa `AnimatedToast`. |

**Impacto visual:** Esses dois toasts têm aparência diferente do resto — cores, tipografia, espaçamento e animação não seguem os tokens do Contrato de Redesign.

### 1.4 O que o wrapper customizado já faz

O arquivo `src/components/ui/sonner.tsx` já é um wrapper completo que:

- Importa `Toaster` e `toast` do Sonner
- Re-exporta `toast` com métodos `.success()`, `.error()`, `.warning()`, `.info()`, `.loading()` — cada um renderiza `AnimatedToast`
- Cada variante mapeia para um `AnimatedBadgeStatus` correto (`success` → `"success"`, `error` → `"danger"`, etc.)
- O `<Toaster />` já está montado no `src/app/layout.tsx`

### 1.5 CSS: Dois sistemas de estilização de toast

Existem duas camadas de CSS competindo:

| Camada | Escopo | Arquivo |
|---|---|---|
| CSS do wrapper (`.ct-toaster`, `.ct-toast`) | Aplicado quando o `Toaster` do wrapper é usado | `src/app/globals.css` (linhas ~886-1068) |
| CSS genérico Sonner (`[data-sonner-toast]`) | Aplicado a QUALQUER toast do Sonner | `src/app/globals.css` (linhas ~1070-1100) |

O CSS genérico em `[data-sonner-toast]` aplica animações (`ct-toast-in`, `ct-toast-out`) que conflitam com as animações do wrapper (que usa `motion/react` via `AnimatedToast`).

---

## 2. Problemas Identificados

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| P1 | **~131 arquivos ignoram o wrapper** e importam `toast` diretamente do `"sonner"` — nenhum usa `AnimatedToast` | Alta | Toast visualmente inconsistente; o sistema visual cuidadosamente construído não é aplicado |
| P2 | **2 componentes criam toast 100% customizado** com markup inline | Alta | Feedback visual completamente diferente do resto do sistema |
| P3 | **CSS genérico `[data-sonner-toast]`** aplica animação sobreposta ao wrapper | Média | Dupla animação quando o wrapper é usado; efeitos colaterais visuais |
| P4 | **Sem auditabilidade/governança** — o sistema não respeita o padrão de feature flag do Super-admin | Média | Viola AI_RULES §6 (controle pelo Super-admin) |
| P5 | **Tipografia e labels inconsistentes** — `sonnerToast` usa estilos Sonner nativos vs. wrapper usa tokens do projeto | Média | Font-size, peso, tracking e labels diferem entre os dois caminhos |

---

## 3. Arquitetura do Sistema Unificado

### 3.1 Princípio

> Um único ponto de entrada: `import { toast } from "@/components/ui/sonner"`.  
> Nenhum componente importa diretamente de `"sonner"`.

### 3.2 Componentes

```
src/
├── components/
│   ├── ui/
│   │   └── sonner.tsx              ← Ponto de entrada único (já existe, refinado)
│   └── motion/
│       └── animated-toast.tsx      ← Componente visual do toast (já existe, refinado)
├── lib/
│   └── toast/
│       ├── toast.ts                ← Re-export canônico (barrel file)
│       ├── toast-variants.ts       ← Definições de variante por contexto
│       └── toast-presets.ts        ← Presets para cenários repetidos
```

### 3.3 API pública proposta

```typescript
// Import canônico — NUNCA importar de "sonner" diretamente
import { toast } from "@/lib/toast";

// Métodos disponíveis (mesmo do wrapper atual):
toast.success("Lead salvo com sucesso.");
toast.error("Não foi possível conectar.");
toast.warning("Atenção: ação irreversível.");
toast.info("Nova versão disponível.");
toast.loading("Processando...");
toast.message("Mensagem genérica.");

// Presets para cenários recorrentes:
toast.leadAssigned(leadName);        // → success com contexto
toast.actionCompleted("Lead deletado"); // → success com duração padrão
toast.syncError("Falha na sincronização"); // → error com duração longa
toast.permissionDenied();            // → warning sem ação
```

### 3.4 Variantes por contexto

| Variante | BadgeStatus | Duração padrão | Uso |
|---|---|---|---|
| `success` | `"success"` | 4500ms | Operações CRUD, salvamento, envio |
| `error` | `"danger"` | 8000ms | Falhas de rede, permissão, validação |
| `warning` | `"warning"` | 6000ms | Ações irreversíveis, dados incompletos |
| `info` | `"info"` | 4500ms | Atualizações, novas versões, orientação |
| `loading` | `"loading"` | Indefinido | Processos assíncronos em andamento |
| `message` | `"neutral"` | 4500ms | Mensagens sem semântica forte |

---

## 4. Plano de Implementação

### Fase 1: Consolidar o wrapper como fonte única (2-3h)

1. **Atualizar `src/components/ui/sonner.tsx`**
   - Manter a API existente (já está correta)
   - Adicionar método `toast.message()` para o caso genérico
   - Garantir que o `Toaster` tenha `richColors={false}` para não sobrescrever estilos

2. **Criar barrel `src/lib/toast.ts`**
   - Re-export `{ toast }` de `@/components/ui/sonner`
   - Adicionar presets contextualizados

3. **Refinar `src/components/motion/animated-toast.tsx`**
   - Adicionar variante `"neutral"` ao `STATUS_BORDER` (já existe, apenas documentar)
   - Validar contraste de fundo `bg-card` em light e dark

### Fase 2: Migrar os ~131 arquivos (1-2h — mass find-replace)

Usar ferramenta de codemod ou str_replace em massa:

```bash
# Dry-run: listar arquivos que importam de "sonner" diretamente
rg 'from "sonner"' --files-with-matches -g '*.tsx' -g '*.ts'

# Substituir: "sonner" → "@/components/ui/sonner"
# NOTA: Apenas para arquivos que NÃO já importam de "@/components/ui/sonner"
```

**Regras da migração:**
- `import { toast } from "sonner"` → `import { toast } from "@/components/ui/sonner"`
- **NÃO** alterar imports de tipos (`ToasterProps`, `type ToastT`, etc.)
- **NÃO** alterar mocks em testes (mantêm `vi.mock("sonner", ...)`)
- Verificar se algum arquivo usa `toast.promise()` ou `toast.dismiss()` diretamente — mapear para a API do wrapper

### Faze 3: Refatorar os 2 toasts customizados (3-4h)

#### 3a. `feedback-toast-handler.tsx`

**Antes:** Card HTML inline com bg-card/95, botões Button, labels hardcoded.

**Depois:** Usar `toast.warning()` com `action` callback e `description`:

```typescript
toast.warning(notification.title, {
  description: notification.message,
  duration: Infinity,
  id: `feedback-${notification.id}`,
  action: {
    label: "Registrar agora",
    onClick: () => router.push(`/leads/${notification.leadId}#feedback`),
  },
  cancel: {
    label: "Lembrar depois",
    onClick: () => { snoozeAllFeedback(); toast.dismiss(toastId); },
  },
});
```

**Obs:** O wrapper atual não suporta `cancel` — precisa adicionar suporte a botão secundário no `AnimatedToast`.

#### 3b. `incoming-lead-card.tsx`

**Antes:** Card com header customizado, ícone BellRinging, CTA Link, fila de leads.

**Depois:** Usar `toast.success()` com `action` e `description`:

```typescript
toast.success("Novo lead recebido", {
  description: item.message,
  duration: 10000,
  id: toastId,
  action: {
    label: "Atender agora",
    onClick: () => onResolve(item, "open"),
  },
});
```

**Se a fila de leads precisar de UI rica**, considerar extrair para um componente persistente (não-toast) que aparece como banner no shell, em vez de abusar o sistema de toast.

### Fase 4: Limpar CSS duplicado (1h)

1. **Remover** as regras genéricas `[data-sonner-toast]` (linhas ~1070-1100 em `globals.css`) que conflitam com o wrapper
2. **Manter** apenas as regras `.ct-toaster` que estilizam o wrapper
3. Adicionar `pointer-events: none` ao `.ct-toaster` container e `pointer-events: auto` ao toast individual (já feito)

### Faze 5: Governança e auditabilidade (1-2h)

1. **Feature flag global:** `feature_toast_system_enabled` — permite desativar todos os toasts do sistema (emergência)
2. **Tipos de toast catalogados:** Cada variante de toast registra no `platform_audit_logs` quando exibida em contexto sensível (operações CRUD de dados pessoais, permissões, exports)
3. **Super-admin control:** Em `/super-admin/settings`, seção "Central de Feedback Visual" com toggle para cada variante (success, error, warning, info)
4. **Documentar** em `docs/business-rules.md` a regra: "Toast de feedback segue o sistema unificado; nenhum componente cria toast inline"

---

## 5. Matriz de Impacto

| Área | Arquivos afetados | Esforço |
|---|---|---|
| Wrapper + Barrel | 3 (sonner.tsx, toast.ts, animated-toast.tsx) | Baixo |
| Migração de import | ~131 (find-replace automatizado) | Baixo |
| Feedback toast handler | 1 | Médio |
| Incoming lead card | 1 | Médio-Alto (precisa de UX review) |
| CSS cleanup | 1 (globals.css) | Baixo |
| Governança (Super-admin) | 2-3 (settings page + schema) | Médio |
| Tipos + testes | 3-5 | Médio |

**Esforço total estimado: 8-12h de implementação**

---

## 6. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| `toast.promise()` usado em alguns arquivos pode não ter equivalente no wrapper | Verificar cada uso antes da migração; adicionar se necessário |
| Mock de testes quebram após troca de import path | Manter `vi.mock("sonner")` — o wrapper re-exporta do mesmo pacote |
| O `feedback-toast-handler` depende de `duration: Infinity` | Garantir que o wrapper suporte isso (Sonner já suporta) |
| O `incoming-lead-card` usa fila de eventos e dismiss programático | Validar que `toast.dismiss(id)` funciona pelo wrapper |
| CSS de animação genérico pode afetar outros usos do Sonner | Revisar usos antes de remover; garantir que nenhum toast usa os estilos genéricos |

---

## 7. Critérios de Conclusão

- [ ] Zero imports de `"sonner"` em componentes de UI (exceto testes e o wrapper)
- [ ] Todos os toasts usam `AnimatedToast` com tokens visuais do Contrato de Redesign
- [ ] CSS genérico `[data-sonner-toast]` removido ou isolado
- [ ] `feedback-toast-handler` e `incoming-lead-card` usam o sistema unificado
- [ ] Feature flag de governança implementada e auditável
- [ ] Typecheck passa, build de produção passa
- [ ] Testes existentes passam (com mocks ajustados se necessário)
- [ ] Registro no roadmap e decision-log

---

## 8. Decisões Pendentes (requerem aprovação)

| # | Decisão | Alternativas |
|---|---|---|
| D1 | O `incoming-lead-card` deve continuar como toast ou migrar para banner persistente no shell? | A: Toast unificado / B: Banner persistente (mais visível, mas ocupa espaço) |
| D2 | Adicionar suporte a botão secundário (cancel) no `AnimatedToast`? | A: Sim, adicionar prop `cancel` / B: Usar dois toasts separados |
| D3 | A feature flag de governança deve ser por variante ou global? | A: Por variante (granular) / B: Global (simples) |
| D4 | O barrel `src/lib/toast.ts` deve exportar presets ou apenas re-exportar? | A: Barrel + presets / B: Apenas barrel (mais simples) |
