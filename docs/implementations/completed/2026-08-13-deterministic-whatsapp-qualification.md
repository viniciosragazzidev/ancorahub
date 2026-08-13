# Finalização determinística da qualificação WhatsApp

## Escopo entregue

- A coleta obrigatória segue uma máquina determinística: tipo de plano, vidas, idades, cidade e e-mail avançam um campo por vez.
- Ao receber o último campo, o CRM qualifica o lead, envia apenas a mensagem de transferência e coloca a conversa em `WAITING_HUMAN`.
- Novas mensagens nessa etapa não recebem resposta automática da IA ou de quick replies.
- Quando não houver corretor elegível, o lead permanece qualificado em uma fila com `distributionStatus=queued`, aguardando disponibilidade.
- O Diretor pode excluir um lead da operação por uma exclusão lógica auditável; o histórico é preservado e a IA é fechada para a conversa removida.

## Segurança e governança

- Tenant e cargo são derivados somente do contexto autenticado no servidor.
- A exclusão é autorizada exclusivamente para o papel `director` e gera auditoria.
- A migração `0120_director_lead_soft_delete.sql` adiciona exclusão lógica e o filtro é aplicado à lista, ao detalhe e à busca de lead pelo webhook de canal.

## Validações

- Cenário regressivo reproduzindo a sequência familiar `Familiar → 3 → idades → cidade → e-mail`: passou e transfere sem repetição.
- Política de exclusão por cargo: passou.
- `npm run agent:verify -- --level fast`: passou.
- `npm run build`: passou.
- Migração aplicada com `npm run db:migrate`.
