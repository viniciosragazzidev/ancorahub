# ADR-0038 — Escopo de números WAHA e conexão por papel

## Decisão

Um número WAHA é uma sessão global da infraestrutura, mas recebe um único escopo
operacional: plataforma, empresa ou unidade. Diretor cria números no escopo da
empresa; Gestor cria e administra números somente na unidade vinculada à sessão.
O Super-admin controla a disponibilidade global da capacidade.

## Consequências

- O navegador nunca escolhe tenant ou unidade.
- QR Code é obtido pelo relay autenticado e não expõe a chave do WAHA.
- Pausar e desconectar preserva a auditoria; não há exclusão silenciosa.
- Cadências e envios devem selecionar somente números ativos compatíveis com o
  tenant e a unidade do destinatário.
