# ADR-0041 — Políticas de mensagem por evento operacional

**Estado:** aceita  
**Data:** 2026-09-06

## Contexto

O catálogo de templates Meta, os modelos de texto livre e os pontos que geram
mensagens cresceram de forma independente. A interface permitia associar alguns
templates a eventos, mas os eventos críticos de atribuição ao corretor ignoravam
essa associação para preservar contratos de variáveis. Também não existia uma
forma única de declarar mensagem principal e contingência sem duplicar regras no
chat, na distribuição e nos workers.

## Decisão

O domínio Comunicação passa a possuir uma política versionada por
`tenant + eventKey`. Cada política escolhe, entre recursos do próprio tenant:

- um template Meta aprovado e sincronizado da WABA atualmente conectada;
- uma mensagem livre ativa;
- a ordem principal/contingência permitida para o evento;
- o estado ativo/inativo da política.

O catálogo de eventos é tipado e mantido no servidor. Um item só aparece como
configurável quando existe produtor e contrato de variáveis conhecidos. Adicionar
um evento significa registrar sua chave, público, finalidade, variáveis e política
de janela e conectar o produtor ao mesmo caso de uso; não é permitido criar no
navegador uma chave que nunca será emitida.

O resolvedor é a única autoridade para transformar uma finalidade operacional em
plano de entrega. Páginas, chat e jobs não consultam tabelas de configuração
diretamente. A seleção é persistida como snapshot na outbox antes do efeito externo,
preservando idempotência mesmo se a configuração for editada depois.

## Regras de elegibilidade

1. Primeiro contato ou destinatário sem inbound nas últimas 24 horas usa somente
   template Meta aprovado.
2. Dentro da janela de 24 horas, texto livre pode ser principal ou contingência.
3. Avisos internos ao corretor podem usar template Meta ou texto livre somente pelo
   canal corporativo autorizado. Sessões pessoais do corretor permanecem somente
   leitura.
4. Em `meta_then_waha`, Meta é a primeira tentativa e o WAHA corporativo selecionado
   recebe uma única contingência após falha confirmada antes do aceite.
5. Quando o Diretor escolhe texto livre como principal para um evento interno e o
   WAHA corporativo está ativo, o envio é direto por esse número.
6. Depois que um provedor aceita a mensagem, nenhuma alternativa é enviada. Falhas
   de entrega posteriores são observadas, mas não criam duplicidade automática.

## Segurança e governança

- tenant, WABA, canal e destinatário são derivados no servidor;
- templates Meta devem pertencer à WABA ativa e estar `APPROVED` para publicação;
- mensagens livres devem pertencer ao tenant e estar ativas;
- alterações são auditadas sem conteúdo ou telefone;
- cada política pode ser pausada pelo tenant;
- o Super-Admin pode desativar globalmente a resolução nova com
  `feature_message_event_policies_enabled`, preservando configurações e usando o
  comportamento homologado anterior;
- os kill switches globais existentes de Meta e WAHA continuam governando os
  respectivos efeitos.

## Compatibilidade

Os vínculos legados de `meta_whatsapp_template_usages` são migrados para políticas
Meta-primeiro. Enquanto a migration estiver em rollout, o resolvedor usa o contrato
legado como fallback. Os nomes homologados continuam sendo o último fallback quando
nenhuma política publicada existe.

## Consequências

- a escolha exibida em `/qualificacao` passa a ser a escolha executada;
- o contrato de variáveis é validado antes da ativação;
- a outbox ganha metadados mínimos de snapshot da política e da contingência;
- `/integrations/whatsapp` mantém conexão e saúde do canal; a composição das
  mensagens passa a ter uma única casa em `/qualificacao`.
