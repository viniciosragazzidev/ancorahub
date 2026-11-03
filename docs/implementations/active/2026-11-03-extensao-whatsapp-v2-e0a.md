# Extensão WhatsApp v2: E0a, segurança e rotas

Data: 03/11/2026. Branch: `feat/ext-v2-e0a`. Status: implementada; aguardando revisão do Vigia e QA do Lince.
Plano aprovado: `2026-11-03-extensao-whatsapp-v2.md`, tabela de regras e etapa E0a.
Mapa: `../mapa-ext-e0.md`, itens a, b, c, d e f. Compatibilidade do código manual aprovada em `../respostas-cinzel-e0a.md`.

## Entrega

- `access.ts` centraliza sessão/grant, membro e usuário ativos, unidade ativa do tenant, papel elegível, flags global/tenant e permissão persistida. Ausência de unidade ou configuração habilitada nega acesso. Todas as dez rotas existentes usam o helper. Exchange usa o grant, pois ainda não existe bearer.
- `rate-limit.ts`: janela deslizante por rota normalizada e sessão. Resolve: 60/min; aceite/recusa futuros: 10/min por rota; inbox futuro: 200/h; demais: 60/min. IDs de recursos não criam buckets novos. Resposta uniforme 429, `Retry-After`, sem detalhes pessoais. Buckets expirados são limpos.
- Resolve filtra tenant, corretor e unidade no SQL e devolve o mesmo `NOT_FOUND` para ausência e falta de visibilidade. A borda HTTP também normaliza o resultado legado `FORBIDDEN`.
- `payload.ts` impõe allowlist estrita, inclusive objetos aninhados. CPF, comissão, telefone inteiro e observações internas não são exportados. Campos novos precisam de revisão explícita na E2. Ações exibidas são interseção com permissões da sessão.
- Auditoria `extension.*` inclui `source`, `tenantId`, `deviceId`, `sessionId` e `extensionVersion` do servidor. Status usa o serviço normal do CRM, com override apenas de auditoria no quarto argumento; o terceiro (`system`) permanece indefinido. Feedback checa também as permissões dos campos opcionais status/tarefa.
- Sessão: 7 dias de ociosidade, teto imutável de 30 dias e revogação. Uso autorizado atualiza `lastSeenAt` somente após mais de 5 minutos, com condição no UPDATE. `POST /api/extension/session` rotaciona o bearer com compare-and-swap; `GET` não rotaciona. Rotação não estende `expiresAt` nem escreve `lastSeenAt` novamente.
- Os três pontos que invalidam sessão web em `equipe/actions.ts` também revogam sessões da extensão por usuário e tenant, na mesma transação: autoridade/unidade/papel, desativação individual e em lote. Reativar membro não restaura tokens revogados.
- `createExtensionCodeAction(binding?)` e `createExtensionAuthorizationCode(binding?)` aceitam `{extensionId, deviceId}`. O `extensionId` fica na nova coluna; o dispositivo é vinculado ao hash SHA-256 de `[code, extensionId, deviceId]`. Código vinculado exige o par correto; legado manual conserva hash simples e `extension_id = NULL`. Consumo do grant é atômico com `UPDATE ... RETURNING`, evitando duas sessões pelo mesmo código.

## SQL manual

Arquivo: `drizzle/0216_extension_auth_code_binding.sql`.

```sql
ALTER TABLE extension_auth_codes ADD COLUMN IF NOT EXISTS extension_id text;
```

Aplicar antes do deploy, somente pelo Vinicios. Não foi executado SQL nem `db:migrate`. Não há alteração no journal de migrações automáticas. Nenhum `.env.local` foi copiado.

## Verificação

- `npx tsc --noEmit`: aprovado.
- Vitest focado em `access-route-contract`, `auth-security`, `payload-security`, `rate-limit`, `lead-context`, `schemas` e `equipe/actions.test.ts`: **97 testes aprovados em 7 arquivos**, todos com mocks, sem banco.
- Lint dos helpers, testes novos e `src/app/api/extension`: aprovado sem erros ou avisos.
- `git diff --check`: aprovado. Avisos de normalização LF/CRLF do Git não alteram o resultado.
- A suíte completa/harness full não foi executada: inclui testes fora do escopo, contrariando o gate focado e a proibição de testes com banco desta tarefa.
- `npm run build` não foi executado nesta E0a: o prebuild gera artefatos em `apps/browser-extension`, reservados à E0b. A integração/build completo fica com o Maestro após juntar as etapas; não se declara build de produção aprovado.

## Integração e riscos

- E1 já usa o contrato de binding, conforme conferência do Maestro em `respostas-cinzel-e0a-2.md`. A extensão deve guardar o token devolvido por `POST /api/extension/session` antes da próxima chamada; o bearer anterior deixa de funcionar. Se perder a resposta da rotação, reconectar é a recuperação segura.
- Nenhuma alteração em `apps/browser-extension` ou `scripts/*extension*`; nenhum push, deploy, migração ou acesso ao banco. Aceite e inbox não são implementados aqui: somente seus limites estão preparados para E3/E4.
- Rate limit é por processo, adequado ao Node único atual do Coolify. Reinício limpa buckets; múltiplas réplicas exigem armazenamento compartilhado antes de escalar.
- Reverter o commit restaura o gateway anterior; a coluna nullable pode permanecer sem afetar o legado. Não remover coluna ou restaurar tokens automaticamente.
