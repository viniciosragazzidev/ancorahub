# Plano: Polimento UX do Fluxo de Atendimento e Registro de Venda

## Diagnóstico do fluxo atual

### Problemas identificados no feedback do corretor

1. **Redundância entre LeadActionHub e LeadFeedbackForm**
   - `LeadActionHub` já mostra "Próxima ação" com recomendação baseada no status e pendências do lead
   - `LeadFeedbackForm` aparece **logo abaixo** como um card separado, pedindo essencialmente a mesma informação que o hub já sugeriu
   - O corretor vê duas superfícies concorrentes para "o que fazer agora"

2. **Formulário de feedback sobrecarregado**
   - 5 campos obrigatórios/opcionais: tipo de contato, próxima ação, observação, data do próximo contato, checklist
   - Checklist com perguntas, barra de progresso e múltiplos tipos de resposta (boolean, rating, text, select)
   - O corretor precisa responder tudo antes de poder submeter ("Responda todas as perguntas obrigatórias")
   - Isso cria fricção: o ato de "registrar feedback" vira uma tarefa pesada

3. **Múltiplos pontos de ação concorrentes**
   - `LeadStatusSelector` (no header)
   - `LeadFeedbackForm` (card dedicado)
   - `LeadManagementActions` (sidebar)
   - `LeadActionHub` + shortcuts (card primário)
   - O corretor não sabe qual usar primeiro

4. **Checklist muito intrusivo para feedbacks rápidos**
   - O checklist é carregado automaticamente e aparece SEMPRE dentro do formulário
   - Para um feedback simples ("Cliente não respondeu"), o corretor precisa responder o checklist primeiro
   - A progressão visual (barra de progresso, contador obrigatórias) é útil, mas o timing está errado: deveria vir **depois** do feedback, não **antes**

5. **Status "Em atendimento" mal comunicado**
   - Quando o corretor muda o status para `in_contact`, o formulário de feedback continua aparecendo
   - Não há orientação visual clara de que "agora você está atendendo este lead"
   - O SLA mostrado no header não se conecta visualmente com a ação esperada do corretor

### Problema no registro de venda

1. **RegisterSalePanel não permite selecionar a operadora**
   - O formulário atual tem: número da apólice, início da vigência, valor aprovado, documento de confirmação
   - **Não tem campo para selecionar a operadora (carrier)**
   - O `registerSaleAction` usa `lead.planId` (que pode ser nulo) para vincular o plano/operadora
   - Isso significa que se o lead não tem um plano associado, a venda fica sem referência de operadora
   - A comissão (`generateCommissionSchedule`) depende do `planId` — sem operadora explícita, a comissão pode não ser gerada corretamente

---

## Proposta de solução (sem alterações de banco)

### Prioridade 1: Consolidar o hub de ação + feedback em um único fluxo

**O que muda:**
- O `LeadActionHub` passa a incluir o formulário de feedback **dentro dele**, não como card separado
- Quando o corretor clica em "Registrar feedback" no hub, o formulário expande inline (acordeão/motion)
- O feedback vira uma **ação dentro do hub**, não uma seção separada na página

**Por que resolve:**
- Elimina a redundância de ter dois cards vizinhos com propósitos sobrepostos
- O corretor vê "Próxima ação" e imediatamente pode executá-la
- Reduz o scroll mental: não precisa descer a página para registrar feedback

### Prioridade 2: Simplificar o formulário de feedback (modo rápido vs. modo completo)

**O que muda:**
- O formulário expandido mostra **primeiro** apenas: tipo de contato + "Qual a próxima ação?" (opcional)
- Após submeter o feedback rápido, se o checklist estiver configurado, um segundo passo opcional aparece: "Checklist de qualidade — responda agora ou depois"
- O checklist vira um **widget colapsável**, não um requisito para submissão

**Por que resolve:**
- Feedbacks rápidos ("Cliente não respondeu") levam 2 cliques em vez de 10
- O checklist não bloqueia mais o fluxo — o corretor pode registrar o feedback e depois preencher o checklist
- A barra de progresso do checklist vira um lembrete visual na timeline, não uma barreira

### Prioridade 3: Guia visual de progresso do atendimento

**O que muda:**
- Adicionar um stepper horizontal (etapas) no topo do hub, mostrando:
  ```
  [Lead recebido] → [Em contato] → [Cotação] → [Negociação] → [Fechamento]
  ```
- Cada etapa concluída aparece em verde; a etapa atual fica destacada
- O stepper é puramente visual (sem estado no banco — derivado do `lead.status`)

**Por que resolve:**
- O corretor vê instantaneamente onde está no ciclo de atendimento
- Elimina a confusão "qual o próximo passo" — o stepper mostra visualmente
- Conecta o SLA ao estágio correto: "SLA de primeiro contato" só aparece na etapa 1

### Prioridade 4: Adicionar campo de operadora no registro de venda ✅ CONCLUÍDO

**O que mudou:**
- `RegisterSalePanel` agora tem um `<select>` de operadora **antes** dos campos existentes
- O select lista as operadoras ativas do tenant (`carriers` com `status: "active"`)
- `registerSaleAction` ganhou campo opcional `carrierId: z.string().uuid().optional()` no schema zod
- Lógica de resolução de plano: se `carrierId` for fornecido, verifica se o `planId` do lead pertence à operadora; se não, busca o primeiro plano ativo da operadora
- Metadados da interação incluem `carrierId` + `carrierName` quando selecionados
- `page.tsx` consulta carriers no `Promise.all` e passa `carriers={carriers}` para o painel

**Arquivos alterados:** `register-sale-panel.tsx`, `actions.ts`, `page.tsx`

### Prioridade 5: Remover redundâncias na página de detalhe do lead

**O que muda:**
- `LeadFeedbackForm` é removido como card independente (integrado ao hub)
- `LeadManagementActions` é simplificado para exibir apenas ações que o hub não cobre (reatribuição manual, exclusão)
- `LeadStatusSelector` no header permanece, mas ganha um tooltip "Mude o status para refletir o estágio atual"

**Por que resolve:**
- Elimina a confusão de múltiplos pontos de ação
- O hub passa a ser a superfície central de ação do corretor

---

## Arquivos a serem modificados

| Arquivo | Mudança |
|---|---|
| `src/features/leads/components/lead-action-hub.tsx` | Adicionar formulário de feedback inline (acordeão), stepper de progresso, integrar checklist como widget colapsável |
| `src/app/(dashboard)/leads/[id]/lead-feedback-form.tsx` | Remover como card independente; exportar como componente inline para o hub (modo rápido) |
| `src/app/(dashboard)/leads/[id]/register-sale-panel.tsx` | ✅ Select de operadora + `carrierId` no submit |
| `src/features/post-sale/actions.ts` | ✅ `carrierId` opcional + resolução automática de plano |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Remover `LeadFeedbackForm` como card separado, passar carriers disponíveis para o hub e sale panel |
| `src/app/(dashboard)/leads/[id]/management-actions.tsx` | Simplificar para só mostrar ações não cobertas pelo hub |

---

## Ordem de implementação

```
Semana 1: Prioridade 1 + 2 (Hub consolidado + Feedback rápido)
  ├── Refatorar LeadActionHub para aceitar feedback inline
  ├── Criar modo rápido vs. completo no feedback
  ├── Mover checklist para widget colapsável pós-submissão
  └── Remover LeadFeedbackForm como card independente da page

Semana 2: Prioridade 3 (Stepper visual)
  ├── Criar componente LeadProgressStepper
  ├── Derivar estágio do lead.status
  └── Injetar no topo do LeadActionHub ou do header

Semana 3: Prioridade 4 (Operadora na venda) ✅ CONCLUÍDO
  ├── ✅ Adicionar consulta de carriers no lead detail page
  ├── ✅ Adicionar select de operadora no RegisterSalePanel
  ├── ✅ Estender registerSaleAction com carrierId opcional
  └── ✅ Resolução automática de plano por operadora

Semana 4: Prioridade 5 (Polimento final)
  ├── Simplificar LeadManagementActions
  ├── Remover redundâncias na page
  ├── Typecheck + teste visual
  └── Deploy
```

---

## Riscos e observações

- **Nenhuma migration ou alteração de schema** — tudo usa colunas e tabelas já existentes
- O campo `carrierId` no `registerSaleAction` é **opcional** — vendas existentes continuam funcionando
- ✅ P4 implementado: `carrierId` opcional no schema, select no painel, resolução automática de plano
- O stepper é **puramente visual** derivado do `lead.status` — zero estado novo
- O checklist colapsável usa o mesmo `localStorage` ou estado React, sem persistência extra
- A remoção do `LeadFeedbackForm` como card independente precisa ser coordenada com links de âncora (`#feedback`) — redirecionar para `#lead-actions`
