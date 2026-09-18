# Correções de registro de etapa no modo Corretor

## Escopo

- Exibir o campo de data quando o corretor escolhe `Escolher data` em uma etapa
  que exige acompanhamento.
- Persistir o acompanhamento como tarefa do lead depois do registro da etapa.
- Garantir que o motivo de perda enviado pelo modo Corretor seja um código aceito
  pelo servidor, mantendo compatibilidade com rótulos enviados por versões antigas.

## Arquivos e fluxo afetados

- `src/features/broker-workspace/components/light-lead-detail.tsx`
- `src/features/broker-workspace/follow-up-options.ts`
- `src/features/leads/reminder-actions.ts`
- `src/features/leads/lead-status-constants.ts`
- `src/features/leads/change-lead-status.ts`
- `src/features/broker-workspace/components/light-feedback-view.tsx`

## Validações

- Testes Vitest focados: 7 testes aprovados.
- ESLint nos arquivos alterados: 0 erros; avisos já existentes no componente Lite.
- Type-check: bloqueado somente por `scripts/_tmp-diag2.ts` pré-existente e não
  relacionado (`p.userId` possivelmente nulo).
- `agent:verify --level full`: documentação válida e segurança sem achados; os
  diagnósticos arquitetural/desempenho e o lint global reportaram achados já
  existentes no workspace, fora do escopo desta correção.
- `npm run build`: compilação Next concluída; o type-check do build foi bloqueado
  pelo mesmo `scripts/_tmp-diag2.ts` temporário preexistente.

## Rollback

Reverter somente os arquivos listados acima e o item N11 do roadmap. Nenhuma
migração de banco ou mudança de dependência foi criada.
