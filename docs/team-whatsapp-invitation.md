# Convite de acesso por WhatsApp

## Escopo entregue

O fluxo de `/equipe` continua sendo a origem única para criar acessos. Depois da validação de cargo, unidade, e-mail e CPF no servidor, o sistema cria o perfil e o convite com token aleatório de 32 bytes. O banco armazena somente o hash para validação pública e uma cópia cifrada exclusivamente para o worker de entrega.

Quando existe um canal Meta Cloud corporativo ativo e padrão, uma mensagem é gravada na outbox com chave idempotente `team-invitation:<invitationId>`. O worker protegido por `CRON_SECRET` envia o template `broker_first_access`, com variáveis de nome, empresa e cargo e botão de URL dinâmica. O token nunca fica no frontend, na outbox, nos logs ou em mensagens de erro.

Se o template falhar de forma definitiva, uma segunda tentativa idempotente (`team-invitation-text:<invitationId>`) envia uma mensagem de texto formatada com nome, empresa, cargo e link direto de primeiro acesso. O texto é montado somente no worker a partir do token cifrado; o token nunca é gravado em claro nem aparece em logs. Se a Meta também rejeitar o texto — por exemplo, por regras de janela de atendimento — o acesso não é desfeito e o link manual continua sendo a recuperação oficial.

Sem canal ativo, o acesso ainda é criado e a interface apresenta o link manual `/primeiro-acesso?token=...` como alternativa.

## Estados e auditoria

- `PENDING`: convite criado e aguardando entrega.
- `QUEUED`: mensagem registrada na outbox.
- `SENT`: a Meta aceitou a mensagem; o identificador do provedor é persistido.
- `FAILED`: tentativa encerrada sem expor o erro bruto.
- `ACCEPTED`: colaborador concluiu o primeiro acesso.

Criação, enfileiramento, fallback e conclusão do onboarding geram auditoria. O escopo do tenant vem sempre da sessão do servidor; nenhum `tenantId`, papel ou canal é aceito como autoridade do cliente.

## Configuração operacional

1. Aplicar as migrations `drizzle/0071_team_whatsapp_invitations.sql` e `drizzle/0073_whatsapp_invite_text_fallback.sql`.
2. Configurar `META_WHATSAPP_TOKEN_ENCRYPTION_KEY` (ou `INVITATION_TOKEN_ENCRYPTION_KEY`) com uma chave base64 de 32 bytes.
3. Aprovar na Meta o template `broker_first_access` em `pt_BR`, com três variáveis no corpo e botão URL dinâmico. O fallback de texto é tentado automaticamente quando o template não responde.
4. Manter um canal Meta Cloud ativo e padrão no tenant.
5. Executar o job `/api/internal/jobs/whatsapp` com `Authorization: Bearer $CRON_SECRET` em uma frequência compatível com o plano de hospedagem.

## Limites atuais

O fluxo preserva a tela e a URL de primeiro acesso existentes para não quebrar convites já emitidos. Reenvio e revogação com controles dedicados na tabela de equipe continuam como próxima evolução; a fila já é idempotente e segura para esse acréscimo.
