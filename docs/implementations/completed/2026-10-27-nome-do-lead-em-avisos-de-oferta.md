# Nome do lead nos avisos de oferta

## Objetivo

Identificar o lead nos avisos de oferta perdida, indisponível e expirada enviados ao corretor pelo WhatsApp, sem incluir telefones nem alterar o contrato dos templates aprovados pela Meta.

## Implementação

- Os produtores de indisponibilidade, disputa perdida, expiração e reatribuição agora gravam `[nome do corretor, nome do lead]` na outbox.
- Os eventos `LEAD_ASSIGNMENT_UNAVAILABLE` e `LEAD_ASSIGNMENT_EXPIRED` expõem `lead_nome` para mensagens livres. O nome genérico `{{nome}}` continua representando o corretor, conforme o template aprovado existente.
- O payload do template Meta segue a lista de parâmetros do recurso sincronizado. O template atual de um parâmetro continua recebendo apenas o nome do corretor; mensagens de texto corporativas e fallbacks podem citar o lead.
- O texto usa `o lead *<nome>*`; nenhum campo de telefone é adicionado.

## Arquivos e fluxos

- `src/features/lead-distribution/offers.ts`: disputa perdida e oferta expirada.
- `src/features/notifications/send-push-helper.ts`: aviso oficial de reatribuição.
- `src/features/communication-channels/message-event-catalog.ts`, `message-policy-service.ts` e `template-parameters.ts`: variáveis livres e mapeamento compatível com parâmetros sincronizados.
- `src/features/communication-channels/outbound-service.ts` e `src/features/team-notices/variants.ts`: fallback de texto e variantes enviadas pelo número corporativo.
- Testes dos contratos do evento, parâmetros Meta, renderização de texto e oferta.

## Verificação

- Vitest focado: 5 arquivos, 50 testes aprovados. Nenhum teste de banco foi executado.
- `npx tsc --noEmit -p .`: aprovado.
- ESLint dos arquivos tocados: 0 erros; dois avisos preexistentes de símbolos não usados em `outbound-service.ts`.
- `npm run build` falhou quando o Turbopack rejeitou o `node_modules` ligado fora da raiz do worktree. `npx next build --webpack` passou: compilação, TypeScript e 125 rotas concluídos. Avisos: dependência dinâmica `unpdf/import.meta` e rotas autenticadas tentadas como estáticas, tratadas como dinâmicas.
- Diagnósticos do harness: dois achados de tamanho em `outbound-service.ts` e `offers.ts`, um alerta de `NEXT_PUBLIC_VAPID_PUBLIC_KEY` já existente em `send-push-helper.ts:101`, e dois achados de tamanho/desempenho nos mesmos arquivos. Nenhum desses trechos foi introduzido nesta mudança.
- A verificação agregada `agent:verify --level full` não foi executada porque chama a suíte completa, que inclui os testes `*.db.test.ts` proibidos nesta tarefa. `agent:docs` passou com 18 referências; arquitetura, segurança e desempenho foram executados isoladamente.
- Nenhuma migration, alteração no banco ou push.

## Status

Concluída em 27/10/2026 na branch `feat/lite-listas`.
