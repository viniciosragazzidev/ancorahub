# Plantões no Corretor Lite

**Estado:** concluído no código; QA visual autenticado UX-M1.10 pendente  
**Rota:** `/plantoes`  
**Papel:** corretor no modo Lite  
**Registro UX:** `docs/ux/UX_REDESIGN_CONTROL.md`

## Entrega

- Item Plantões aparece na navegação desktop e mobile Lite somente quando a
  capacidade global está ativa.
- A rota mostra calendário mensal e agenda responsiva. Dias escalados recebem
  indicador; selecionar uma data atualiza a agenda, e selecionar um plantão abre
  detalhes somente leitura em Sheet.
- A agenda reúne regras semanais ativas e escalas mensais publicadas. Uma data
  publicada substitui a regra semanal correspondente; datas sem atribuição
  publicada não escondem a escala semanal, conforme DEC-123.
- O corretor consulta apenas as próprias atribuições. Tenant, usuário e papel são
  derivados da sessão no servidor; a consulta grava evento de auditoria.
- O Super-admin pode desativar a área e configurar horizonte de 1, 3, 6 ou 12
  meses; alterações dos dois controles também são auditadas. Padrão: habilitada,
  três meses.
- Estados de plantão em andamento, pausado, dia sem escala e período vazio ficam
  identificados. Transição da agenda segue `transitions-dev/07-panel-reveal` e
  respeita `prefers-reduced-motion`.

## Arquivos principais

- `src/app/(dashboard)/plantoes/page.tsx`
- `src/features/broker-workspace/components/light-duty-calendar.tsx`
- `src/features/broker-workspace/duty-calendar.ts`
- `src/features/broker-workspace/duty-calendar-queries.ts`
- `src/shared/feature-flags/catalog.ts`
- `src/app/(platform-admin)/super-admin/actions.ts`
- `src/app/(platform-admin)/super-admin/settings/page.tsx`

## Verificação registrada

Evidência detalhada: `reports/agent/verification/2026-09-30-broker-lite-duty-calendar.md`.

- 14 testes focados passaram; lint direcionado, TypeScript no build, verificação
  de encoding e `git diff --check` passaram.
- `next build` direto compilou o app e incluiu `/plantoes` como rota dinâmica.
- `agent:verify` fast/full não iniciou: o bootstrap do `tsx` no Node 24.15.0
  falhou em `uv_os_get_passwd` com `ENOMEM`. O empacotamento opcional da extensão
  não foi executado; a compilação Next do app foi executada diretamente.
- QA visual autenticado nas larguras 320, 360, 375, 390, 412 e 430 px continua
  pendente conforme a etapa global UX-M1.10.
