# Quick Reply antes da IA

O CorreTop resolve mensagens curtas e eventos de atendimento de forma deterministica
antes de carregar configuracao, montar prompt ou chamar o modelo. A mesma camada e
usada pelos webhooks Meta e OpenWA.

## Pipeline

1. Idempotencia por `providerMessageId` e evento Quick Reply.
2. Mensagens do proprio sistema sao ignoradas no webhook.
3. Conversa, memoria e pergunta pendente sao carregadas com tenant do servidor.
4. `QuickReplyResolver` classifica a mensagem e escolhe template/cooldown.
5. Estado, evento, metricas e notificacao sao persistidos.
6. Somente quando nenhuma regra resolve a mensagem a IA e chamada.

## Estados e cooldown

`AI_ACTIVE`, `WAITING_HUMAN`, `HUMAN_IN_PROGRESS`, `PAUSED` e `CLOSED` ficam
persistidos em `ai_conversations`. O mesmo template nao e enviado novamente por
10 minutos; respostas de espera ficam limitadas a duas em 30 minutos, inclusive
apos reinicio do servidor.

## Governanca

O Super-admin pode ativar/desativar `feature_ai_quick_reply_enabled`. O Diretor pode
editar templates por tenant com `updateQuickReplyTemplateAction`; toda alteracao e
auditada. Eventos em `ai_quick_reply_events` registram regra, template, resultado,
notificacao e tokens estimados economizados.

## Evolucao pendente

Adicionar a tela dedicada de edicao em Configuracoes > IA e cenarios E2E com payloads
de audio, imagem e documento reais de cada provedor.
