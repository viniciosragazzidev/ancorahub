# Piloto de feedback de ações e movimento governado

**Estado:** implementação parcial do plano transversal. **Data:** 2026-09-27.  
**Plano:** `docs/ux/INTERACTION_FEEDBACK_GAMIFICATION_PLAN.md`. **Roadmap:** N98 (`partial`).

## Papel, ação e escopo

Papel: corretor escalado recebendo link de confirmação de plantão. Ação principal: confirmar presença. Estados: repouso, pendente, confirmado pelo servidor e falha recuperável. A mensagem de erro fica no contexto e o foco continua no botão para nova tentativa. A rota pública, a API, a elegibilidade, o escopo de tenant e a auditoria existentes não mudam. Disclosure: uma ação e uma mensagem local; sem modal/toast redundante. O hardening de movimento afeta o componente compartilhado, toast e badge, sem nova variante visual ou token.

## Antes e depois

- Antes: `StatefulButton` tinha rótulos padrão em inglês, desabilitava também o estado de erro, aplicava uma cor verde fixa e animava mesmo quando a capacidade global de motion estava desativada. A confirmação de presença não fornecia texto no estado inicial e apagava o erro automaticamente após 1,4 s.
- Depois: texto inicial “Confirmar presença”; pendência e sucesso continuam indisponíveis para duplo envio; erro mostra “Tentar novamente” **clicável**, mantém a razão da falha e permite retry sem timer. Sucesso aparece somente após resposta positiva da API. `StatefulButton`, `AnimatedToast` e `AnimatedBadge` respeitam o controle global de motion já auditado e `prefers-reduced-motion`. O botão usa o token semântico `success`.
- Não há pontuação ou gamificação nova. Metas, temporadas, premiações e ranking existentes exigem decisão própria antes de alteração.

## Arquivos

- `src/components/ui/stateful-button.tsx`: estados, texto, semântica e controle de movimento.
- `src/app/confirm_presence/confirm-duty-presence-button.tsx`: ação inicial e retry persistente.
- `src/app/confirm_presence/confirm-duty-presence-button.test.tsx`: sucesso após falha e reenvio.
- `src/components/motion/animated-toast.tsx` e `animated-badge.tsx`: movimento condicionado ao controle compartilhado.
- `docs/ux/INTERACTION_FEEDBACK_GAMIFICATION_PLAN.md`, `UX_REDESIGN_CONTROL.md`, `UX_CHANGELOG.md` e `src/features/roadmap/roadmap-data.ts`: viabilidade, etapa e rastreabilidade.

## Verificação e limites

O teste focado de retry passou. Lint dirigido, lint geral (0 erros, 1.077 avisos preexistentes), TypeScript e `node node_modules/next/dist/bin/next build` passaram. `npm run build` parou antes do Next no prebuild da extensão por acesso negado ao `apps/browser-extension/src/background/service-worker.ts`, condição já relatada em outras implementações. O harness `fast` registrou 1.163 testes aprovados e 2 falhas fora do escopo (contrato do dashboard Lite e timeout no dashboard), em `reports/agent/verification/2026-09-27T13-15-16.073Z.md`. O harness `full` registrou documentação válida, segurança sem achados, diagnósticos de arquitetura/desempenho apenas para o arquivo preexistente `roadmap-data.ts` acima de 32 KB, e 1.160 testes aprovados/5 falhas fora do escopo (Lite, contrato de texto WAHA, política de avisos de equipe e dois timeouts de dashboard/plantão), em `reports/agent/verification/2026-09-27T13-28-35.879Z.md`. Os testes focados desta entrega não falharam.

O QA autenticado de UX-M1.10 permanece pendente; a inspeção estática de rotas não equivale a teste por papel. Não afirmar que os demais fluxos já usam o novo contrato. A política existente do Super Admin controla/desativa as animações do piloto sem apagar dados; a alteração do controle já é auditada em `platform_audit_logs`.

**Rollback:** restaurar o comportamento anterior dos componentes e botão sem modificar API ou banco; as mensagens e confirmações persistidas permanecem intactas.
