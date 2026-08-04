# Ilustrações voxel contextuais

## Objetivo

Usar ilustrações discretas e coerentes com a identidade da Âncora Corretora para
orientar estados importantes, sem competir com dados, alertas ou ações operacionais.

## Escopo entregue

- Biblioteca reutilizável em `src/components/illustrations/voxel-illustration.tsx`,
  com imagens decorativas, carregamento adiado e opacidade reduzida em light e dark.
- Bússola no onboarding inicial.
- Ilustração de documentos no estado de fila documental em dia.
- Hub de integrações no contexto da página de integrações.
- Caixa de entrada vazia no Workspace do Corretor.
- Ilustração autoral de âncora e mar na saudação do Workspace, visível apenas em
  telas grandes para preservar a leitura em mobile.

## Decisões

- As imagens são decorativas (`alt` vazio e `aria-hidden`); o texto contextual da
  interface comunica o estado para leitores de tela.
- A opacidade é centralizada no componente compartilhado (`50%` em light e `40%`
  em dark), sem introduzir animações, dados novos, ações ou permissões.
- Os arquivos são PNGs RGB opacos com fundo `#F4F4F4`; nenhum documento, dado de
  cliente, token ou informação identificável foi usado na geração.

## Arquivos afetados

- `public/illustrations/voxel/*.png`
- `src/components/illustrations/voxel-illustration.tsx`
- `src/app/(dashboard)/dashboard/_components/broker-workspace.tsx`
- `src/features/onboarding/components/onboarding-hero.tsx`
- `src/features/documents/components/documents-workspace.tsx`
- `src/features/communication-channels/components/integrations-catalog.tsx`

## Risco e reversão

Mudança exclusivamente visual e reversível. Remover as chamadas de
`VoxelIllustration` restaura os estados anteriores; não altera dados, rotas,
auditoria ou integrações.

## Validações

- `npm run agent:verify -- --level fast`: aprovado — documentação, type-check e
  231 testes.
- Build de produção confirmado pela Vercel no deployment
  `dpl_Ey4RTEpjZYEZbkshgHLomSTyTL88`.
- `npm run agent:verify -- --level full` e o build local excederam o limite de
  execução desta sessão antes de retornar resultado; a construção remota de
  produção concluiu com sucesso.

## Ajuste posterior — 04/08/2026

- A ilustração marítima da saudação do Workspace foi reduzida e centralizada,
  recebeu maior opacidade e deixou de usar a superfície de card. O container não
  recorta mais a imagem; o fundo neutro foi removido do próprio asset para preservar
  o canvas do dashboard em qualquer tema.

- Todas as cinco ilustrações foram regeneradas sobre chroma key e convertidas para
  PNG RGBA com transparência real. Cada asset foi validado com cantos transparentes
  e margem livre mínima de 126 px ao redor do objeto; o componente compartilhado
  passa a limitar imagem por `max-width` e `max-height` com `object-contain`.
