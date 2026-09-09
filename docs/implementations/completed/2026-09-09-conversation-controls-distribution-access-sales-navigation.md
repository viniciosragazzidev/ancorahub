# Controles de conversas, acesso a filas e navegação de vendas

## Objetivo

Entregar quatro ajustes operacionais aprovados: exclusão segura de chats avulsos por Diretor/Gestor, definição de filas exclusiva do Diretor, abertura mais rápida de `/vendas` e filtro `Sem Atribuição` na visão do Diretor em `/leads`.

## Decisões e segurança

- A exclusão existe apenas para conversas sintéticas `unassigned-*` e é novamente autorizada no servidor.
- Tenant e papel vêm da sessão. Telefone recebido é apenas o identificador validado do alvo, nunca autoridade de escopo.
- Antes de excluir, o servidor bloqueia mensagens ou telefones vinculados a lead, cliente ou perfil da equipe.
- A auditoria usa um hash de tenant + telefone e a quantidade removida; telefone, corpo e demais dados pessoais não são gravados.
- `feature_unlinked_conversation_deletion_enabled` permite ao Super-admin interromper a capacidade e toda alteração da flag gera auditoria de plataforma.
- Gestor não recebe o conteúdo da aba `Filas & Unidades`; URL direta é normalizada para `Matriz de Roteamento`. Supervisor não recebe acesso administrativo à rota.

## Desempenho de Vendas

- `/vendas` entrou no conjunto de destinos antecipados do sidebar.
- `loading.tsx` reutiliza o skeleton canônico e dá resposta imediata durante a renderização dinâmica.
- Filiais e vendas começam em paralelo.
- A receita total é calculada sobre a lista já consultada, removendo uma segunda leitura idêntica de vendas sem mudar filtros ou escopo.

## Arquivos principais

- `src/features/conversations/actions.ts`
- `src/features/conversations/delete-unlinked-conversation-policy.ts`
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`
- `src/features/lead-distribution/distribution-view-access.ts`
- `src/app/(dashboard)/leads/distribuicao/page.tsx`
- `src/app/(dashboard)/vendas/page.tsx`
- `src/app/(dashboard)/vendas/loading.tsx`
- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/leads/leads-workspace.tsx`

## Verificação

- Testes dirigidos: política de exclusão, classificação de conversas, acesso às views de distribuição e contrato de navegação de vendas.
- ESLint dirigido: sem erros; avisos preexistentes permanecem separados.
- Engineering Harness completo: passou em documentação, escopo, arquitetura,
  segurança, desempenho, lint, TypeScript, 688 testes e build de produção.
- Após a validação completa, os contratos Meta receberam `unidade` no primeiro
  acesso e os aliases `nome`, `telefone`, `interesse`, `n_dependentes` e
  `cidade` no aceite. Essa extensão foi validada por testes focados e TypeScript;
  por solicitação, o build não foi repetido depois dessa extensão.

## Rollback

Desativar a exclusão pelo controle global do Super-admin interrompe a capacidade imediatamente. Para rollback de código, reverter os arquivos acima; não há migração de banco nem dependência nova.
