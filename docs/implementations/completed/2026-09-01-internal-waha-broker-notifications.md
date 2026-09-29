# Número WAHA oficial para avisos internos de corretores

## Objetivo

Permitir que o Diretor escolha um número WAHA da própria empresa para os avisos
operacionais enviados aos corretores, sem alterar atendimento de leads nem o
canal oficial de clientes.

## Escopo entregue

- Política por tenant, com número WAHA de escopo `tenant` e ativo.
- Modos `meta_then_waha` e `waha_direct`.
- O primeiro usa WAHA uma única vez após falha confirmada no envio Meta; o
  segundo não cria tentativa Meta.
- Aplicação somente a eventos internos elegíveis de atribuição e oferta.
- Outbox registra rota e número usados; toda alteração da política é auditada.
- O Super-admin pode desligar a capacidade globalmente.

## Segurança e limites

O tenant vem da sessão do Diretor. O número selecionado é revalidado no servidor
por `tenant_id`, escopo e estado ativo. A configuração não é aceita para números
de filial ou de outro tenant. Conversas de lead/cliente, qualificação, campanhas
e mensagens pessoais não usam esta política.

## Dados e rollback

A migration `0141_internal_waha_broker_notifications.sql` cria a política por
tenant e registra rota/número no outbox. O rollback de aplicação é seguro ao
desligar a flag global ou desativar a política do tenant; os registros históricos
da outbox permanecem auditáveis. A reversão da migration só deve ocorrer depois
de confirmar que não há dependência de registros da nova política.

## Validação

- Testes de escopo dos eventos internos e da tela de conexão WAHA.
- Type-check, verificação rápida, verificação completa e build completo
  concluídos localmente em 2026-09-01.
- Homologação manual: atribuir um lead em cada modo, observar a mensagem no
  número selecionado e simular falha Meta para confirmar uma única contingência.
