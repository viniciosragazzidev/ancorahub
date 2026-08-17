# Timeout de qualificação para fila configurada

## Escopo

Ao passar o timeout configurado de qualificação, o lead deve ir para a fila já
configurada pelo seu tipo/campanha e receber uma tentativa de distribuição nessa
mesma unidade.

## Implementação

- A varredura resolve a rota ativa da campanha e valida que a fila pertence ao
  tenant e está ativa; sem rota, mantém a fila de intake.
- A alteração do lead, interação, evento de distribuição e auditoria são
  transacionais. O job de distribuição é enfileirado somente após o commit.
- O processador seleciona corretores apenas da unidade da fila. A falta de
  elegíveis mantém o job em retry, sem esgotar o lead como conflito.

## Validação

- Teste unitário confirma que a rota configurada vence a fila anterior e que a
  ausência de rota preserva o intake.
- Teste de domínio confirma que a fila sem corretor elegível é repetível.
