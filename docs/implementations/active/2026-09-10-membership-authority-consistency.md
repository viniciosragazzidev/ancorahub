# Consistência de vínculo e autoridade da equipe

Status: validado em 2026-09-10

## Objetivo

Garantir que exclusão, desativação e alteração de cargo/unidade sejam aplicadas
no servidor e não deixem sessões com autoridade anterior.

## Regras implementadas

- O contexto autenticado considera apenas vínculos ativos; vínculos legados
  inativos não bloqueiam o vínculo atual.
- Mais de um vínculo ativo continua bloqueado até existir seleção explícita de
  tenant.
- Alterar cargo, papel ou unidade revoga as sessões do membro e registra
  auditoria, exigindo nova autenticação com a autoridade atualizada.
- Excluir um membro remove o vínculo do tenant e revoga suas sessões; a
  identidade global não é apagada porque pode pertencer a outro tenant.

## Verificação esperada

- Teste unitário da seleção de vínculo ativo.
- Testes de autorização e exclusão da equipe.
- Type-check, build e harness completo antes da publicação.

## Evidências

- 24 testes focados de vínculo ativo, autorização e ações de equipe aprovados.
- Suíte completa aprovada: 154 arquivos e 699 testes.
- Type-check e build de produção aprovados.
- Harness: documentação e segurança sem regressões; diagnósticos
  arquiteturais e de desempenho permaneceram informativos.
