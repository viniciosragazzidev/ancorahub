# CRM_PAGE

Use para uma visão operacional que combina contexto de entidade, relacionamento, histórico e ações de trabalho. `CHAT_PAGE` é usado quando a conversa é o foco dominante.

## Composição

Contexto do registro → estado e responsável → ação principal → conteúdo por prioridade → atividade/relacionamentos → ações secundárias.

- A propriedade, estágio e dados de escopo são apresentados com origem autorizada.
- Ações de transferência, status e proprietário mostram consequência e exigem confirmação quando o risco pedir.
- Informações sensíveis usam divulgação progressiva e autorização no servidor.

## Estados obrigatórios

loading, registro não encontrado, vazio contextual, sincronizando, erro recuperável, sem permissão e indisponível.

## Não usar

Não transformar a página em painel de métricas decorativas ou duplicar regras comerciais no layout.
