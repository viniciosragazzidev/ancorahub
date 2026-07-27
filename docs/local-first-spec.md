# Local-First e UI Otimista — CorreTop

## Objetivo

O CorreTop é uma operação de alta densidade: o corretor precisa registrar notas e
mover leads sem esperar a rede para obter feedback visual. A interface deve reagir
imediatamente, sincronizar em segundo plano e recuperar o estado anterior quando o
servidor rejeitar a operação.

## Princípios obrigatórios

1. Toda mutação interativa tem estado otimista imediato.
2. O servidor continua sendo a autoridade final para validação, autorização e tenant.
3. Falhas fazem rollback do estado local e informam o usuário sem quebrar o layout.
4. Cache e queries futuras devem usar chaves com `tenantId` e `userId`, por exemplo:
   `['leads', tenantId, userId, leadId]`.
5. Dados otimistas nunca são considerados persistidos até a confirmação do servidor.

## Paleta adaptada ao CorreTop

O plano original usava azul de marca como estado confirmado. O CorreTop mantém a
identidade neutra aprovada e traduz os estados para tokens semânticos, permitindo
que claro e escuro permaneçam consistentes:

| Estado | Token | Claro | Escuro |
|---|---|---|---|
| Local/pendente | `--sync-local` | `--warning` | `--warning` |
| Confirmado | `--sync-confirmed` | `--primary` | `--primary` |
| Erro/rollback | `--sync-error` | `--destructive` | `--destructive` |
| Superfície local | `--sync-surface` | `--muted` | `--muted` |

Não usar azul como fundo, CTA ou cor dominante. Estados devem ter texto/ícone além
da cor para permanecerem compreensíveis e acessíveis.

## Estados visuais

- **Local:** opacidade reduzida, texto muted e `ArrowsClockwise` em `--sync-local`.
- **Confirmado:** opacidade total, texto foreground e ícone definitivo em
  `--sync-confirmed`.
- **Erro:** rollback dos dados, borda em `--sync-error`, mensagem “Não sincronizado —
  tentar novamente” e shake curto.

## Mutações prioritárias

### Nota na timeline

`Cmd/Ctrl+Enter` ou o botão de nota deve limpar o campo, inserir a nota no topo com
ID temporário, mostrar estado local e chamar `addLeadNoteAction`. Em sucesso, a
timeline é revalidada; em erro, o item temporário é removido e o formulário volta a
ser utilizável.

### Mudança de status

O badge e o seletor devem refletir o novo status imediatamente. A ação do servidor
valida a transição, tenant, filial e papel. Em erro, o status anterior é restaurado,
o controle recebe feedback de erro e o usuário é notificado.

## Movimento e acessibilidade

- Entrada otimista: até 120ms, `translateY(4px)` para `0`.
- Confirmação: até 180ms, easing `--ease-smooth-out`.
- Erro: shake curto, sem deslocar elementos irmãos.
- `prefers-reduced-motion: reduce` remove deslocamentos e mantém apenas alterações
  informativas de opacidade/cor.

## TanStack Query

O `QueryClient` global fica em `AppProviders`, com cache isolado por usuário e tenant.
Hooks de domínio devem usar `useMutation` com `onMutate`, snapshot, `onError` para
rollback e `onSettled` para invalidação. Nunca montar uma chave sem `tenantId` e
`userId` vindos do contexto confiável.

## Implementação transversal atual

O contrato passou a ser obrigatório para novas superfícies e foi conectado ao
shell autenticado em `src/components/providers/realtime-sync-provider.tsx` e
`src/components/app-providers.tsx`:

- Supabase Realtime invalida e atualiza leads, notificações, documentos, tarefas,
  clientes, vendas e equipe sem depender de F5.
- Mudanças em outra aba são propagadas por `BroadcastChannel`.
- Retorno à aba, reconexão e uma verificação de contingência de 15 segundos
  reconciliam o servidor automaticamente.
- O estado de conexão é anunciado com uma mensagem acessível, sem afirmar que
  uma operação foi persistida enquanto estiver offline.
- `src/utils/local-first/use-local-first-mutation.ts` é o adaptador obrigatório
  para novas mutações: aplica otimista, rollback, confirmação e invalidação.
- Chaves de cache devem usar `localFirstQueryKey(tenantId, userId, domínio, id)`.

As mutações legadas continuam funcionando com Server Actions e `revalidatePath`,
mas novas features não devem adicionar `router.refresh()` como única estratégia.
Cada migração de domínio precisa trocar a atualização manual pelo adaptador local
first e adicionar teste de sucesso, rollback, permissão e reconexão.

## Definition of Done

- [ ] Feedback otimista aparece antes do retorno HTTP.
- [ ] Rollback está implementado e testado para falhas de validação/permissão.
- [ ] Query keys contêm tenant e usuário.
- [ ] Nenhum layout shift acontece durante a sincronização.
- [ ] Loading usa `ShimmerSkeleton` com a geometria final.
- [ ] Claro e escuro foram verificados com tokens semânticos.
- [ ] Reduced motion foi preservado.
- [ ] Item correspondente em `/roadmap` contém descrição, resumo, arquivos e validações.
