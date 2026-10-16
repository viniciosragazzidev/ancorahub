# Lite: ficha de lead para supervisor e gestor

## Escopo

Completar `/leads/[id]` no Lite de supervisor e gestor com a qualificação, os dados
do lead e a conversa espelhada do WhatsApp, mantendo as ações de gestão que cada
papel já possui. A implementação reutiliza os componentes de informação do
`LightLeadDetail` do corretor e o leitor de conversas da equipe.

## Regras confirmadas

- O supervisor só abre lead de corretor vinculado à própria equipe; o gestor só
  abre lead da unidade derivada da sessão.
- A qualificação, os dados e a conversa são somente leitura nesta página.
- A conversa não tem opções, links de ação ou envio de mensagem para supervisor e
  gestor. Não há permissão nova de escrita.
- O chat ao vivo só é renderizado quando `getSupervisorLiteWhatsAppStatus` (o mesmo
  helper do perfil G3) confirma uma conexão `ready` do corretor responsável. Sem
  conexão, a página mostra “Visualização ao vivo desativada, corretor não conectou o
  WhatsApp” e oculta as mensagens.
- As ações atuais permanecem: Repassar, Cobrar corretor e Ver corretor para
  supervisor; alterar etapa e repassar dentro da unidade para gestor. Tarefas e
  documentos do gestor continuam disponíveis.
- Sem alteração de banco, migration, tokens ou primitives.

## Validação

- `npx vitest run` nos testes do detalhe, transcript, projeção de dados, escopo de
  conversas e ação de etapa do gestor: 5 arquivos, 15 testes passaram.
- `npx tsc --noEmit -p .`: passou usando a junction local de `node_modules`.
- Teste do estado desconectado: a mensagem de indisponibilidade aparece e o transcript
  não é renderizado.
- ESLint focado nos arquivos alterados: 0 erros e 3 avisos `no-explicit-any` em linhas
  preexistentes da página de leads.
- `npm run agent:verify -- --level fast`: documentação e typecheck passaram; a suíte
  geral terminou com 407 aprovados, 10 falhas e 16 ignorados, todas fora dos testes
  alterados. Inclui dois casos que esperam `DATABASE_URL`, ausente no ambiente.
- `npm run agent:verify -- --level full`: documentação, mudanças, arquitetura,
  segurança e desempenho passaram; typecheck passou. Lint parou por 971 ocorrências
  de mojibake em `docs/business-rules.md`,
  `src/features/leads/management-actions.test.ts` e
  `src/features/reports/metrics/lead-quality-period.test.ts`, não alterados. A suíte
  geral terminou com 410 aprovados, 7 falhas e 16 ignorados, fora do escopo desta
  mudança.
- A prévia sintética `/dev/e1-preview` foi iniciada por `npx next dev --webpack -p
  3135`, sem `.env.local`; o servidor não respondeu à compilação da rota dentro do
  timeout de 120 s. Não foram gerados prints; QA visual claro/escuro em 1440px e
  390px continua pendente.
