# Sincronização das anotações privadas ao trocar de conversa

## Problema

No painel de perfil de `/conversas`, o componente das anotações permanecia
montado ao selecionar outro lead. Seu estado era inicializado uma única vez,
então a anotação da conversa anterior continuava visível até atualizar a página.

## Correção

- A seção `LeadNotesSection` agora usa o ID do lead como chave de identidade.
- Ao selecionar outra conversa, a seção é recriada e carrega a anotação daquela
  conversa a partir da chave já existente no `localStorage`, usando a anotação
  inicial recebida do servidor quando não houver valor local.
- O contrato de atendimento e a forma de persistência das anotações não mudam.

## Validação

- Build de produção executado conforme o checklist do projeto.
- Não foi criado nem executado teste automatizado nesta correção.
- Evidências do build e limitações do ambiente: `reports/agent/verification/2026-09-29-conversation-private-notes-selection-sync.md`.
