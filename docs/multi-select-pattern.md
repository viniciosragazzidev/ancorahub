# Padrão de Multi-Select para Tabelas

## Visão geral

O sistema de multi-select permite selecionar uma, várias ou todas as linhas de uma
tabela e executar ações em lote baseadas no papel do usuário (diretor, gestor,
corretor).

### Peças reutilizáveis

| Peça | Localização | Função |
|------|-------------|--------|
| `useMultiSelect` hook | `src/hooks/use-multi-select.ts` | Gerencia estado de seleção |
| `SelectionToolbar` | `src/components/ui/selection-toolbar.tsx` | Toolbar animada com contagem + ações |

### API do hook

```ts
const multi = useMultiSelect(allIds: string[])

multi.selectedIds   // string[] — IDs selecionados
multi.count          // number
multi.isAllSelected  // boolean
multi.toggle(id)     // alterna um ID
multi.selectAll()    // seleciona / desmarca todos
multi.clear()        // limpa seleção
multi.isSelected(id) // boolean
multi.setSelected(ids) // substitui a seleção
```

### API do componente

```tsx
<SelectionToolbar
  selectedCount={multi.count}
  totalCount={items.length}
  onClear={multi.clear}
>
  {/* ações específicas por role */}
</SelectionToolbar>
```

---

## Como aplicar em qualquer tabela

### 1. Importar as peças

```tsx
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
```

### 2. Adicionar o hook

```tsx
const itemIds = useMemo(() => items.map((item) => item.id), [items]);
const multi = useMultiSelect(itemIds);
```

> `allIds` precisa ser memoizado com `useMemo` para evitar loops de
> re-renderização.

### 3. Adicionar coluna de checkbox

**Tabela customizada** (`<table>` do shadcn):

```tsx
<TableHead className="w-10 pl-4">
  <Checkbox
    aria-label="Selecionar todos"
    checked={multi.isAllSelected}
    onCheckedChange={multi.selectAll}
  />
</TableHead>

// Na linha:
<TableRow data-selected={multi.isSelected(item.id) || undefined}
          className="data-[selected]:bg-primary/[0.04]">
  <TableCell className="w-10 pl-4">
    <Checkbox
      aria-label={`Selecionar ${item.nome}`}
      checked={multi.isSelected(item.id)}
      onCheckedChange={() => multi.toggle(item.id)}
      onClick={(e) => e.stopPropagation()}
    />
  </TableCell>
```

**DataTable** (`@tanstack/react-table`):

```tsx
const columns: ColumnDef<T>[] = [
  {
    id: "select",
    header: () => (
      <Checkbox
        aria-label="Selecionar todos"
        checked={multi.isAllSelected}
        onCheckedChange={multi.selectAll}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Selecionar ${row.original.nome}`}
        checked={multi.isSelected(row.original.id)}
        onCheckedChange={() => multi.toggle(row.original.id)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  // ... demais colunas
];
```

### 4. Adicionar a toolbar com ações

```tsx
<SelectionToolbar
  selectedCount={multi.count}
  totalCount={items.length}
  onClear={multi.clear}
>
  {/* Ações visíveis apenas para diretores e gestores */}
  {(role === "director" || role === "manager") && (
    <>
      <BulkActionDialog ... />
      <Button ... />
    </>
  )}

  {/* Ações visíveis apenas para corretores */}
  {role === "broker" && (
    <Button ... />
  )}
</SelectionToolbar>
```

---

## Padrões de ações em lote

### Padrão A — Server action com `useActionState` (leads, equipe)

Crie uma server action que recebe `FormData` com os IDs e os parâmetros da ação.

```ts
// actions.ts
export async function bulkMyAction(
  _prev: MyState,
  formData: FormData,
): Promise<MyState> {
  const ids = formData.getAll("itemIds") as string[];
  // ... itera sobre ids, executa ação, coleta resultados
  return { success: true, message: `${ids.length} atualizados.` };
}
```

No componente, use `useActionState` com um `<form>`:

```tsx
const [state, formAction, pending] = useActionState(bulkMyAction, {});

<SelectionToolbar ...>
  <form action={formAction}>
    {multi.selectedIds.map(id => (
      <input key={id} name="itemIds" type="hidden" value={id} />
    ))}
    <Button type="submit" name="targetStatus" value="active">
      Ativar
    </Button>
  </form>
</SelectionToolbar>
```

### Padrão B — `startTransition` com ação síncrona (documentos)

Use `startTransition` quando a ação não segue o padrão `(prev, formData)`.

```tsx
const [, startTransition] = useTransition();

const handleBulk = (status: string) => {
  startTransition(async () => {
    const res = await bulkAction(multi.selectedIds, status);
    if (res.success) {
      toast.success("Concluído.");
      setItems(prev => prev.filter(d => !multi.selectedIds.includes(d.id)));
      multi.clear();
    }
  });
};

<SelectionToolbar ...>
  <Button onClick={() => handleBulk("approved")} disabled={multi.count === 0}>
    Aprovar
  </Button>
</SelectionToolbar>
```

---

## Feedback ao usuário

Sempre inclua um `useEffect` para feedback visual:

```tsx
useEffect(() => {
  if (state.success) {
    toast.success(state.message ?? "Operação concluída.");
    multi.clear(); // limpa seleção após sucesso
  }
  if (state.error) {
    toast.error(state.error);
  }
}, [state.success, state.error, state.message]);
```

> **Atenção:** não coloque `multi` no array de dependências do `useEffect`,
> pois o objeto retornado pelo hook é recriado a cada render. Em vez disso,
> referencie `multi.clear` diretamente ou extraia a função:

```tsx
const clearSelection = multi.clear;

useEffect(() => {
  if (state.success) {
    toast.success("OK");
    clearSelection();
  }
}, [state.success, clearSelection]);
```

---

## Highlight visual nas linhas

Use o atributo `data-selected` com Tailwind:

```tsx
<TableRow
  data-selected={multi.isSelected(item.id) || undefined}
  className="data-[selected]:bg-primary/[0.04]"
>
```

O `|| undefined` garante que o atributo não exista quando o item não está
selecionado, fazendo o seletor CSS `data-[selected]` funcionar corretamente.

---

## Exemplos reais no código

| Tabela | Arquivo | Hook | Ações | Padrão |
|--------|---------|------|-------|--------|
| Leads (lista) | `leads-workspace.tsx` | `useMultiSelect` | Alterar status, Reatribuir | Diálogos |
| Leads (kanban) | `leads-workspace.tsx` | `useMultiSelect` (compartilhado) | Alterar status, Reatribuir | Diálogos |
| Documentos | `documents-workspace.tsx` | `useMultiSelect` | Aprovar, Rejeitar | `startTransition` |
| Equipe | `team-members-table.tsx` | `useMultiSelect` | Ativar, Desativar | `useActionState` + form |

---

## Boas práticas

1. **Um hook por tabela** — o `useMultiSelect` deve viver no componente que
   contém a tabela, não em um nível acima. Ele recebe os IDs de todos os itens
   visíveis.
2. **IDs estáveis** — use `useMemo` para computar o array de IDs, evitando
   referências novas a cada render.
3. **Ações extraídas** — se a toolbar aparecer em múltiplas tabs do mesmo
   componente (ex.: Kanban + Lista), extraia os children da toolbar em um
   `useMemo` para evitar duplicação.
4. **Role guard server-side** — sempre reforce a autorização na server action,
   nunca confie apenas no front-end.
5. **Limpeza da seleção** — após uma ação em lote bem-sucedida, chame
   `multi.clear()` para resetar a UI.
