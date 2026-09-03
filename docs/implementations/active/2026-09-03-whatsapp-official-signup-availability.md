# Disponibilidade do cadastro do WhatsApp oficial

## Objetivo

Garantir que o Diretor consiga iniciar o Embedded Signup em
`/integrations/whatsapp` quando a capacidade Meta está ativa e os identificadores
de abertura estão presentes, sem expor ou exigir segredos privados no navegador.

## Alteração

- a ação de conexão não é mais ocultada por falha no diagnóstico completo de
  segredos do servidor;
- ela permanece bloqueada e explica o motivo somente quando o kill switch está
  desligado ou App ID/Config ID não estão disponíveis;
- o Config ID aceita o nome server-side
  `META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`, com compatibilidade para o nome
  público existente;
- a conclusão do cadastro continua validando e usando segredos apenas no servidor.

## Segurança e rollback

O tenant e a permissão de Diretor continuam derivados da sessão. Nenhum token ou
segredo é enviado ao navegador. Reverter os quatro arquivos da alteração restaura
o bloqueio visual anterior; não há migration nem alteração de dados.

## Verificações

- testes de interface do Embedded Signup e do status do canal oficial;
- ESLint dirigido;
- validação documental;
- `git diff --check`.
