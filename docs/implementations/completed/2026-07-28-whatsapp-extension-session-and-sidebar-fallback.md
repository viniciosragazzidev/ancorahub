# Sessão e fallback de telefone da extensão — 28/07/2026

## Problema corrigido

O WhatsApp Web atual mostra apenas o nome no cabeçalho da conversa. Como a extensão não resolve lead por nome, ela permanecia oculta mesmo para um lead autorizado. O popup também não indicava uma sessão já conectada.

## Entrega

- O adaptador passa a ler o telefone visível no painel de dados do contato (`drawer-right`) quando este estiver aberto pelo corretor.
- Quando o cabeçalho não expõe o número, há fallback limitado ao estado React da conversa aberta. A leitura é restrita ao nó do cabeçalho ativo, com limites de profundidade e quantidade; não percorre lista nem histórico.
- Um sidebar de perfil de conversa anterior não é usado quando o nome não coincide com o cabeçalho atual.
- O popup consulta a sessão existente. Para sessão válida, exibe “Conectada neste navegador” e disponibiliza desconexão remota; em falha de revogação, preserva o token local.
- A extensão foi versionada como `0.1.1`.
- Quando há leads duplicados para o mesmo telefone no tenant, a resolução seleciona o lead visível para a sessão antes de retornar `FORBIDDEN`; isso evita que um registro de outra carteira oculte um lead autorizado.
- A extensão é apresentada como **AncoraHub Assistant** no popup, painel, manifesto, instalação e download.

## Validações

- Teste de regressão do adaptador: estado da conversa, sidebar visível e sidebar incompatível.
- `npm run build:extension`, `npm run type-check`, `npm test` (37 arquivos, 184 testes), `npm run build` e `npm run agent:docs` aprovados.

## Risco e rollback

O fallback React depende de uma estrutura interna do WhatsApp e pode deixar de existir. A falha é segura: sem telefone confirmado a interface permanece oculta. Remover apenas esse fallback mantém a leitura do sidebar visível.
