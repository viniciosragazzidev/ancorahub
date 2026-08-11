# Reorganização operacional do detalhe do lead

## Objetivo

Organizar `/leads/[id]` como uma superfície de atendimento: identidade e ação atual no topo, etapas em abas horizontais e contexto persistente na lateral. O critério de aceite é manter todas as ações, permissões e proteções de dados existentes sem criar novos fluxos.

## Escopo e arquivos

- `src/app/(dashboard)/leads/[id]/page.tsx`: promove o painel de contexto para uma lateral fixa no desktop, mantém as abas em uma faixa horizontal e usa superfícies mais suaves no modo claro.
- `src/app/(dashboard)/leads/leads-workspace.tsx`: suaviza as superfícies da fila no modo claro, preservando os valores atuais no dark mode.
- `src/features/roadmap/roadmap-data.ts`: registra o refinamento no item 4.4.

## Decisões

Não houve decisão de domínio nova. A composição preserva as regras BR-001 a BR-005 e BR-020 a BR-028: tenant e permissões continuam derivados no servidor e contato sensível permanece mascarado quando o atendimento ainda não foi iniciado.

## Validações

- `npx eslint src/app/(dashboard)/leads/[id]/page.tsx src/features/roadmap/roadmap-data.ts`: sem erros no escopo alterado.
- `npm run type-check`: passou.
- `npm run build`: passou.
- `npm run agent:verify -- --level full`: documentação, segurança, testes (269) e build passaram. O comando termina com falhas de lint preexistentes em diretórios locais de referência e `temp_deskcomm_crm`, fora do escopo desta alteração.

## Riscos e rollback

A mudança é exclusivamente de composição. Reverter os dois arquivos acima restaura a disposição anterior sem migrações, mutações ou perda de dados.
