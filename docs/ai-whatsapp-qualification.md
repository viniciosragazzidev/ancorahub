# Qualificação inicial por IA no WhatsApp

## Estado

Entrega parcial e reversível (DEC-050). A capacidade é controlada no Super-admin em
**Configurações → Qualificação automática no WhatsApp** e também pelo setting
`feature_ai_whatsapp_qualification_enabled`.

## Fluxo implementado

1. O webhook de entrada cria o lead e mantém o fluxo de distribuição existente.
2. O serviço cria uma sessão única por `tenant_id + lead_id`.
3. A mensagem inicial e as respostas são enfileiradas em `whatsapp_outbound_messages`.
4. O webhook Meta associa a mensagem ao lead, chama o mesmo motor de IA configurado
   em `src/features/ai/engine.ts` e avança quatro perguntas curtas.
5. Ao concluir, o resumo fica na sessão e uma interação auditável é registrada para
   o corretor continuar o atendimento.
6. A sessão expira, pode ser desativada globalmente e possui proteção de atualização
   otimista para impedir duas respostas concorrentes.

## Limites atuais

### Observabilidade e resiliência do atendimento

- O agente usa `openrouter/auto` como modelo padrão. Configurações antigas com
  `anthropic/claude-3.5-sonnet` são substituídas automaticamente por uma nova
  tentativa no Auto Router quando a API retorna `404 / No endpoints found`.
- O webhook aguarda o processamento da resposta antes de confirmar o evento,
  evitando que uma execução serverless seja encerrada enquanto a IA ainda está
  chamando a API ou enviando a resposta ao WhatsApp.
- Os eventos operacionais usam o prefixo `[ai-wpp]` e registram apenas IDs,
  status, modelo, latência e contagem de tokens. Tokens, telefones, prompts,
  respostas e payloads não são gravados nos logs.
- A mensagem de saída é atualizada com `sent` ou `failed` e o `messageId` da
  Meta. Isso permite confirmar no log e no histórico se a IA respondeu e se a
  Meta aceitou o envio.

- A primeira mensagem é texto. A Meta pode exigir template aprovado quando não há
  janela de 24 horas; nesse caso o outbox registra a falha sem quebrar o recebimento
  do lead.
- O fechamento da sessão ainda não cria score de negócio nem distribui novamente o
  lead: o motor de distribuição atual continua sendo a autoridade.
- A tela de edição de roteiro por tenant e métricas operacionais ficam para a fase
  seguinte.

## Dados e segurança

As tabelas `ai_qualification_configs` e `ai_qualification_sessions` são escopadas por
tenant, possuem chave única por lead, não armazenam tokens e registram início,
conclusão, transferência e falhas em `audit_logs`. O segredo da Meta continua apenas
em `communication_channels.access_token_ciphertext`.
