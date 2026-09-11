# Rotação sequencial de ofertas de lead até aceite

## Objetivo

Eliminar o estado operacional em que um lead aguarda redistribuição manual antes de
esgotar os corretores elegíveis. O fluxo canônico passa a manter o lead em circulação
automática até um corretor aceitar ou até o conjunto elegível ser completamente
tentado.

## Comportamento entregue

- O corretor selecionado vira owner provisório na mesma transação que registra a oferta; o aceite apenas confirma a titularidade.
- Existe no máximo uma oferta ativa por lead, serializada com row lock no próprio
  lead antes da inserção da oferta.
- Recusa, expiração e estouro de SLA retornam ao mesmo processador e trocam
  diretamente para o próximo corretor elegível, sem limpar o owner antes da troca.
- Corretor sem canal corporativo utilizável e falha ao enfileirar a mensagem ficam
  registrados como tentativa cancelada e o motor avança imediatamente.
- O job de distribuição espera exatamente até `expiresAt` sem consumir a contagem de
  tentativas enquanto aguarda resposta.
- Ao esgotar um ciclo, outro ciclo automático é aberto; pausas explícitas ou falta
  real de elegíveis mantêm o owner anterior e ficam recuperáveis pelas tasks.
- O aceite continua atômico com `SELECT FOR UPDATE`, completa jobs pendentes e só
  então dispara os efeitos pós-atribuição.
- Consultas e mutações de oferta/canal foram reforçadas com escopo explícito de
  tenant.
- Uma oferta somente bloqueia o próximo corretor depois de receber o ID durável da
  mensagem na outbox. Tentativas interrompidas antes desse vínculo são recuperáveis.
- A recuperação administrativa processa os jobs com concorrência controlada e envia
  exatamente as mensagens recém-criadas, reportando como enviadas apenas as ofertas
  confirmadas pelo provedor.
- Campos de qualificação nulos não excluem leads antigos do re-seed. A task também
  recupera owners provisórios cujas ofertas expiraram.
- Entradas manual, CSV, webhook, Meta Ads e qualificação delegam a escolha ao mesmo
  serviço de distribuição; o algoritmo legado não possui mais consumidores.

## Arquivos principais

- `src/features/lead-distribution/service.ts`
- `src/features/lead-distribution/offers.ts`
- `src/features/lead-distribution/jobs.ts`
- `src/features/lead-distribution/domain.ts`
- `src/features/leads/sla.ts`
- `src/features/leads/webhooks/services/lead-effect-outbox.ts`
- `src/features/notifications/send-push-helper.ts`

## Validação

- Testes focados: 59 aprovações entre domínio, jobs, importação, webhook, escopo e métricas de oferta.
- Harness fast: 158 arquivos e 721 testes aprovados; evidência em `reports/agent/verification/2026-09-11T12-50-23.095Z.md`.
- Harness full: documentação, segurança, lint sem erros, type-check, 721 testes e build Next.js aprovados; evidência em `reports/agent/verification/2026-09-11T12-59-09.575Z.md`.
- `git diff --check`: aprovado, apenas avisos de normalização LF/CRLF.
- Diagnósticos de arquitetura/desempenho registraram somente os três arquivos grandes já existentes (`page.tsx`, `service.ts` e roadmap), sem achado de segurança ou erro bloqueante.
