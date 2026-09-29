# Limite rígido por fila e remoção manual de atribuição

**Estado:** implementação em validação  
**Decisão:** DEC-113  
**Escopo:** fazer o limite de leads por corretor valer independentemente em cada fila e oferecer a Diretor/Gestor a remoção auditada da atribuição no drawer do lead, inclusive após o início do atendimento.

## Regras aprovadas

- A contagem inclui leads comerciais ativos atribuídos ao corretor na mesma fila; filas distintas não compartilham o teto.
- A reserva de capacidade é serializada junto da criação da oferta. Sem vaga, o lead fica aguardando na fila, sem exceder o teto.
- Remover atribuição preserva etapa, horários e histórico; cancela ofertas e jobs pendentes e coloca o lead em `manual_hold`, fora da distribuição automática até ação manual.
- Leads perdidos, convertidos, arquivados ou excluídos não podem ser desatribuídos.
- Tenant e escopo continuam derivados e validados no servidor. Ação registra evento de distribuição e auditoria.

## Arquivos principais

- `src/features/lead-distribution/service.ts`, `offers.ts`, `queue-capacity.ts` e testes: seleção por capacidade e reserva transacional concorrente.
- `src/features/leads/management-actions.ts`, `assignment-domain.ts` e testes: remoção validada, preservação de histórico, cancelamento, evento e auditoria.
- `src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx` e `leads-workspace.tsx`: confirmação e atualização otimista no drawer.
- `/leads/distribuicao`: estado explícito de ação manual, sem inclusão no worker automático.
- `docs/business-rules.md`, `docs/decision-log.md`, `docs/adr/0042-guaranteed-lead-ownership.md` e `docs/lead-distribution-implementation-status.md`: contrato do domínio atualizado.

## UX e segurança

O drawer reutiliza `ConfirmDialog` e componentes/tokens compartilhados existentes; não cria primitiva visual nem muda a hierarquia do redesign. O texto de confirmação esclarece preservação do histórico e ausência de retorno automático. A Server Action valida UUID, resolve tenant/papel/escopo da sessão no servidor e atualiza com condições concorrentes para não sobrescrever estado que mudou.

## Verificação

- [x] Testes focados: 66 aprovados em 5 arquivos.
- [x] `npm run type-check`.
- [ ] `npm run agent:verify -- --level fast`.
- [ ] `npm run agent:verify -- --level full` e build.
- [ ] Revisão de diff e `git diff --check`.

## Riscos e reversão

O novo estado `manual_hold` é intencionalmente excluído do re-seed; só ação manual o retoma. Mudança da regra de limite pode aumentar espera quando todas as vagas estão ocupadas. Reversão de código deve preservar auditoria/eventos já gravados e precisa tratar `manual_hold` explicitamente; não apagar histórico nem converter leads para um estado automático por migração.
