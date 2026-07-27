# Escala visual de plantão

Atualizado em 15/07/2026.

## Estado

Implementação parcial, liberada na rota `/leads/distribuicao/plantao`.

## Entregue

- Entidade `duty_roster_assignments` na migration `0040_duty_roster_assignments.sql`.
- Consulta semanal escopada por tenant e filial.
- Calendário visual com drag-and-drop usando dnd-kit já instalado.
- Adição de corretor a um plantão.
- Movimento de corretor entre plantões.
- Remoção com estado inativo.
- Busca de corretores por unidade.
- Rollback otimista em falhas.
- Validação de corretor ativo, vínculo à filial e conflito de horário.
- Auditoria de criação, movimento e remoção.
- Motor automático passa a filtrar corretores pela escala quando existe cobertura cadastrada; sem escala cadastrada, preserva o comportamento anterior.

## Permissões

- Diretor pode alternar entre as filiais do próprio tenant.
- Gestor recebe somente a própria filial.
- Corretor não acessa a tela de edição.

## Pendências

- Exceções por data para folga, férias e substituições.
- Fluxo de rascunho e publicação, se aprovado pelo produto.
- Feature flag e painel de governança do Super-admin.
- Cópia de semana.
- Resize de cartões e grade fina de 15/30 minutos.
- Eventos tipados para integrações e atualização de relatórios.

A tabela de regras de plantão continua disponível como fallback e permanece sendo a fonte das filas e prioridades operacionais.

