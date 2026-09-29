# Reenvio de convite de ativação

## Decisão e plano

Solicitação aprovada em 25/09/2026: reenviar o convite de ativação e gerar um novo quando o anterior estiver ausente, vencido ou revogado. O reenvio manual continua renovando o token por 72 horas e substituindo convites pendentes anteriores.

1. Resolver convite, perfil ou vínculo do membro no tenant autenticado; revalidar papel/unidade e impedir reativação de contas já ativadas ou desabilitadas.
2. Preservar a autoridade atual do vínculo ou do último convite; recriar e auditar em transação. Reutilizar o envio de convite que processa o ID exato da outbox.
3. Permitir ativação da própria identidade pendente já vinculada, sem conflitar com outro membro. Disponibilizar reenvio para todos os papéis gerenciáveis pendentes e controle global pelo Super-admin.
4. Testar convites inexistentes/vencidos/revogados, identificação por vínculo, permissões, tenant, conta ativa e entrega. Executar harness fast/full e build.

## UX e governança

UX-M1.10: preservar menu contextual de /equipe. Gestão: ação reenviar ativação; pendência imediata, resultado de fila, erro e atualização da lista. Sem novos tokens ou animações. Super-admin: controle reversível de reenvio, auditado; prazo existente de 72h e template configurável preservados.

## Validação

Pendente. Nenhum envio real será efetuado durante os testes.
