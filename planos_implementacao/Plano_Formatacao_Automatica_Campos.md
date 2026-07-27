# Plano: Formatação Automática de Campos em Formulários

**Data:** 2026-07-15
**Status:** Planejado

---

## 1. Objetivo

Adicionar formatação automática (máscara) em **todos os campos de input** do sistema, identificando o tipo de dado pelo `id` e/ou `name` do campo. O usuário digita apenas números/letras e o campo se formata sozinho em tempo real.

---

## 2. Formatos Suportados

| Tipo | ID/Name detectado | Formato | Exemplo |
|------|--------------------|---------|---------|
| **CNPJ** | `cnpj` | `XX.XXX.XXX/XXXX-XX` | `41.817.056/0001-70` |
| **CPF** | `cpf` | `XXX.XXX.XXX-XX` | `123.456.789-09` |
| **Telefone/Celular** | `telefone`, `phone`, `celular`, `whatsapp`, `tel` | `(XX) XXXXX-XXXX` | `(11) 99999-9999` |
| **CEP** | `cep` | `XXXXX-XXX` | `01310-000` |
| **RG** | `rg`, `identidade`, `documento` | `XX.XXX.XXX-X` | `12.345.678-9` |
| **Moeda/Valor** | `valor`, `preco`, `price`, `comissao`, `comission`, `monthlyPrice` | `R$ 1.234,56` | `R$ 1.500,00` |
| **Inscrição Estadual** | `ie`, `inscricao_estadual` | `XXX.XXX.XXX.XXX` | `123.456.789.012` |
| **Placa** | `placa` | `XXX-XXXX` | `ABC-1234` |
| **Número ANS** | `ansCode`, `ansRegistration`, `ans` | Somente números | `12345` |
| **Cartão SUS** | `sus`, `cns`, `cartao_sus` | `XXX XXXX XXXX XXXX` | `123 4567 8910 1112` |
| **Agência/Banco** | `agencia`, `agency` | `XXXX-X` | `1234-5` |
| **Conta Bancária** | `conta`, `account` | `XXXXX-X` | `12345-6` |
| **Data** | `data`, `date`, `nascimento`, `validade`, `vencimento` | `DD/MM/AAAA` | `15/07/2026` |

---

## 3. Estratégia de Implementação

### Abordagem: Hook `useInputFormat` + Aprimoramento do Componente `Input`

Em vez de criar um componente separado, a estratégia é:

**Camada 1 — Utility de formatação (`src/shared/utils/format.ts`)**
Funções puras para cada formato: `formatCNPJ`, `formatCPF`, `formatPhone`, `formatCEP`, `formatRG`, `formatCurrency`, `formatDate`, `formatIE`, etc. Cada função remove tudo que não é dígito e aplica a máscara.

**Camada 2 — Hook `useFormat` (`src/shared/utils/use-format.ts`)**
Hook que recebe um `id`/`name` e retorna a função de formatação adequada. Detecta o tipo pelo padrão do ID.

**Camada 3 — Modificação no componente `Input` (`src/components/ui/input.tsx`)**
- Adiciona o hook `useInputFormat` que:
  1. Lê o `id` do campo
  2. Detecta automaticamente o tipo de formato (CNPJ, CPF, phone, CEP, etc.)
  3. Aplica a formatação no `onChange`
  4. Expõe `inputMode` correto automaticamente
- Para casos especiais (moeda), permite prop `format="currency"`

---

## 4. Arquivos a Modificar

### 4.1. Criar

| Arquivo | Conteúdo |
|---------|----------|
| `src/shared/utils/format.ts` | Funções puras de formatação para cada tipo |
| `src/shared/utils/format.test.ts` | Testes unitários de todas as funções |

### 4.2. Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/ui/input.tsx` | Adicionar hook `useInputFormat` que detecta tipo pelo `id` e aplica formatação automática no input |
| `src/components/ui/input-currency.tsx` (opcional) | Componente específico para campos de moeda com R$ prefix |

---

## 5. Mapa de Detecção

A detecção do formato será feita analisando o `id`/`name` do input:

```typescript
const FORMAT_MAP: Record<string, FormatType> = {
  // CNPJ
  cnpj: "cnpj",
  "input-cnpj": "cnpj",
  
  // CPF
  cpf: "cpf",
  "input-cpf": "cpf",
  
  // Phone
  telefone: "phone",
  phone: "phone",
  celular: "phone",
  whatsapp: "phone",
  tel: "phone",
  "lead-phone": "phone",
  "carrier-phone": "phone",
  "team-phone": "phone",
  
  // CEP
  cep: "cep",
  
  // RG
  rg: "rg",
  identidade: "rg",
  
  // Data
  data: "date",
  date: "date",
  nascimento: "date",
  validade: "date",
  vencimento: "date",
  
  // Currency / Price
  price: "currency",
  preco: "currency",
  preco: "currency",
  valor: "currency",
  comissao: "currency",
  comission: "currency",
  monthlyPrice: "currency",
  monthly_price: "currency",
};
```

---

## 6. Lista de Todos os Formulários que Precisam de Formatação

### 6.1. Leads

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/app/(dashboard)/leads/_components/manual-lead-form.tsx` | `lead-phone` (telefone) | Phone |
| `src/app/(dashboard)/leads/_components/manual-lead-form.tsx` | `lead-email` (email) | Email (validação) |

### 6.2. Equipe

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/app/(dashboard)/equipe/team-invite-form.tsx` | `team-email` | Email |
| `src/app/(dashboard)/equipe/member-actions.tsx` | `member-email` | Email |

### 6.3. Super Admin / Super Dev (Tenants)

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/app/(platform-admin)/super-admin/tenants/page.tsx` | `cnpj` | CNPJ |
| `src/app/(platform-admin)/super-dev/tenants/page.tsx` | `cnpj` | CNPJ |

### 6.4. Catálogo / Operadoras

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/features/catalog/components/catalog-client.tsx` | `carrier-phone` | Phone |
| `src/features/catalog/components/catalog-client.tsx` | `carrier-email` | Email |
| `src/features/catalog/components/catalog-client.tsx` | `ansCode` | Números ANS |
| `src/features/catalog/components/catalog-client.tsx` | `monthlyPrice` (vários) | Currency |

### 6.5. Comissões

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/features/commissions/components/commission-rules-manager.tsx` | `baseValue`, `percentage`, `fixedValue` | Currency |
| `src/features/financeiro/components/commission-details.tsx` | Valores financeiros | Currency |

### 6.6. Metas

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/features/goals/components/goal-form.tsx` | Valor meta | Currency |
| `src/features/goals/components/goal-form.tsx` | Start/end date | Date |

### 6.7. Configurações

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/app/(dashboard)/settings/_components/integrations-tab.tsx` | `integration-name` | Nome (sem formatação) |

### 6.8. Notificações

| Arquivo | Campos | Formato |
|---------|--------|---------|
| `src/features/notifications/components/push-notification-manager.tsx` | Input de mensagem | Texto (sem formatação) |

---

## 7. Implementação Detalhada

### 7.1. Funções Utilitárias (`src/shared/utils/format.ts`)

```typescript
// Remove tudo que não é dígito
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// CNPJ: XX.XXX.XXX/XXXX-XX
export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// CPF: XXX.XXX.XXX-XX
export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

// Phone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

// CEP: XXXXX-XXX
export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

// RG: XX.XXX.XXX-X
export function formatRG(value: string): string {
  const digits = onlyDigits(value).slice(0, 9);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

// Inscrição Estadual: XXX.XXX.XXX.XXX
export function formatIE(value: string): string {
  const digits = onlyDigits(value).slice(0, 12);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1.$2");
}

// Moeda: R$ 1.234,56 (remove formatação para envio)
export function formatCurrency(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Unformat para envio ao servidor
export function unformat(value: string): string {
  // Remove toda formatação, mantém apenas números e ponto decimal
  return value.replace(/\D/g, "");
}

export function unformatCurrency(value: string): number {
  // "R$ 1.234,56" → 1234.56
  const cleaned = value
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
}
```

### 7.2. Hook de Formatação

O hook `useInputFormat` será adicionado DENTRO do componente `Input.tsx` para detectar automaticamente o formato com base no `id`/`name`:

```typescript
type FormatType = "cnpj" | "cpf" | "phone" | "cep" | "rg" | "currency" | "ie" | "date" | "placa" | "ans" | "cns" | "agencia" | "conta" | "none";

const FORMAT_DETECTORS: { pattern: RegExp; type: FormatType }[] = [
  { pattern: /cnpj/i, type: "cnpj" },
  { pattern: /cpf/i, type: "cpf" },
  { pattern: /telefone|phone|celular|whatsapp/i, type: "phone" },
  { pattern: /cep/i, type: "cep" },
  { pattern: /rg|identidade|documento/i, type: "rg" },
  { pattern: /valor|preco|price|comissao|comission/i, type: "currency" },
  { pattern: /inscricao_estadual|ie$/i, type: "ie" },
  { pattern: /placa/i, type: "placa" },
  { pattern: /ans/i, type: "ans" },
  { pattern: /data|date|nascimento|validade|vencimento/i, type: "date" },
];

function detectFormat(id?: string, name?: string): FormatType {
  const source = [id, name].filter(Boolean).join(" ");
  for (const detector of FORMAT_DETECTORS) {
    if (detector.pattern.test(source)) return detector.type;
  }
  return "none";
}
```

### 7.3. Modificação no Input.tsx

```typescript
function Input({ className, type, id, name, onChange, value: controlledValue, defaultValue, ...props }: InputProps) {
  const formatType = detectFormat(id, name);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  
  const isControlled = controlledValue !== undefined;
  const displayValue = isControlled ? controlledValue : internalValue;
  
  const formattedValue = useMemo(() => {
    if (!displayValue || formatType === "none") return displayValue;
    return applyFormat(String(displayValue), formatType);
  }, [displayValue, formatType]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatType !== "none" ? applyFormat(raw, formatType) : raw;
    
    if (!isControlled) setInternalValue(formatted);
    
    // Criar um evento sintético com o valor limpo para o onChange original
    const cleanValue = formatType === "currency" ? unformatCurrency(formatted) : unformat(formatted);
    
    // Chamar onChange original se existir (com valor formatado)
    if (onChange) {
      // O onChange recebe o evento original, mas o valor já formatado
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value: formatted },
      };
      onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
    }
  };
  
  return (
    <InputPrimitive
      id={id}
      name={name}
      type={type}
      value={formattedValue ?? ""}
      onChange={handleChange}
      {...props}
    />
  );
}
```

---

## 8. Plano de Execução (Ordem de Implementação)

### Fase 1 — Base (prioridade alta)
1. Criar `src/shared/utils/format.ts` com todas as funções de formatação
2. Implementar hook de detecção automática de formato no `Input.tsx`
3. Testar com campos CNPJ e Telefone nos formulários existentes

### Fase 2 — CNPJ nos formulários de Tenant (prioridade alta)
4. Aplicar formatação CNPJ em:
   - `super-admin/tenants/page.tsx` — campo `cnpj`
   - `super-dev/tenants/page.tsx` — campo `cnpj`

### Fase 3 — Telefone e Email (prioridade alta)
5. Aplicar formatação de telefone em:
   - `leads/_components/manual-lead-form.tsx` — campo `lead-phone`
   - `catalog/components/catalog-client.tsx` — campo `carrier-phone`
6. Garantir validação de email nos campos de email

### Fase 4 — Campos Financeiros (prioridade média)
7. Criar suporte a `format="currency"` no Input para campos de moeda
8. Aplicar em:
   - `commissions/components/` — campos de valor/comissão
   - `catalog/components/catalog-client.tsx` — campos `monthlyPrice`
   - `goals/components/goal-form.tsx` — campo de valor da meta
   - `financeiro/components/` — campos financeiros

### Fase 5 — Campos de Data (prioridade média)
9. Aplicar formatação de data nos campos com type="date" ou id contendo "data"
   - `goals/components/goal-form.tsx`
   - `leads/components/lead-tasks.tsx` — campo `task-due`

### Fase 6 — Testes e Validação (prioridade alta)
10. Escrever testes unitários para todas as funções de formatação
11. Testar manualmente todos os formulários modificados
12. Garantir que o valor enviado ao servidor está sem formatação (apenas dígitos)

---

## 9. Considerações Importantes

### 9.1. Valor Limpo vs. Valor Formatado
- O usuário **vê** o valor formatado (ex: `(11) 99999-9999`)
- O servidor **recebe** o valor limpo (ex: `11999999999`)
- A limpeza deve acontecer no `onChange` antes de enviar ao form action

### 9.2. InputMode
- CNPJ/CPF/CEP/Telefone → `inputMode="numeric"` (já existe em alguns)
- Moeda → `inputMode="decimal"`
- Data → `inputMode="numeric"` (ou usar type="date" nativo)

### 9.3. Campos Controlados vs. Não-Controlados
- Formulários com `useActionState` geralmente usam inputs não-controlados
- Inputs com `value` e `onChange` explícitos são controlados
- O hook precisa funcionar em ambos os casos

### 9.4. Colisão com Type Nativo
- Inputs com `type="date"` não devem receber formatação extra
- Inputs com `type="number"` usam formatação nativa do browser
- A detecção automática deve ignorar tipos nativos (date, time, datetime-local, number)

### 9.5. Performance
- As funções de formatação são puras e executam em O(n)
- Use `useMemo` para evitar reformatação desnecessária em renders
- Para listas grandes (ex: planos com preços por faixa etária), a formatação é por campo individual

---

## 10. Critérios de Aceite

- [ ] CNPJ formata automaticamente enquanto digita: `41817056000170` → `41.817.056/0001-70`
- [ ] Telefone formata: `11999999999` → `(11) 99999-9999`
- [ ] CEP formata: `01310000` → `01310-000`
- [ ] Moeda formata em tempo real: `1500` → `R$ 1.500,00`
- [ ] Valor enviado ao servidor está SEM formatação
- [ ] Funciona em todos os navegadores suportados (Chrome, Firefox, Safari, Edge)
- [ ] Campos não mapeados continuam funcionando sem formatação
- [ ] Testes unitários passam para todas as funções de formatação
