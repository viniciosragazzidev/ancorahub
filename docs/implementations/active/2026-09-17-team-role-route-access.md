# Cargos, permissões e visibilidade de rotas

## Escopo

- O editor de `/equipe/cargos` agora separa capacidades operacionais de rotas visíveis.
- Cada rota utiliza a capacidade existente como requisito de segurança; a chave `route:<id>` apenas restringe a visibilidade quando o cargo possui overrides explícitos.
- Sem nenhuma rota explícita, o comportamento permanece compatível com o RBAC anterior.
- O cargo personalizado selecionado no convite é validado no servidor, armazenado no convite e aplicado à associação no onboarding.
- O mesmo cargo pode ser alterado na edição de um membro. Alterações de autoridade continuam revogando as sessões existentes.
- Cargo `Corretor` fixa o perfil de acesso em `Operação individual` e não permite que um valor anterior do formulário seja reenviado.

## Auditoria e isolamento

As validações continuam tenant-scoped e os eventos de cargo existentes registram as mudanças. Nenhum tenant, cargo ou rota é aceito a partir de um identificador não validado no servidor.

## Migração

`drizzle/0149_custom_role_invitation.sql` adiciona `broker_invitations.custom_role_id` com `ON DELETE SET NULL`, preservando convites existentes.
