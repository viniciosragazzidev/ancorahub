# Movimento Venancor nos primitivos de UI

Fonte: `docs/design-system/MOTION.md`, seção “Aplicação por componente”. Os tamanhos e as APIs existentes dos primitivos foram preservados.

- Botão: pressão `0.97` em 100 ms; estado opcional `loading` com spinner no espaço do ícone ou do conteúdo, largura preservada, `aria-busy` e bloqueio de ativação.
- Campos: transição de foco de 150 ms já existente; erro com cor e shake de dois ciclos/4 px/250 ms; `FieldSuccess` com check de entrada suave.
- Checkbox/switch: traço e deslize de 150–200 ms. Abas: indicador com `layoutId` preservado e conteúdo com fade de 150 ms.
- Dialog/sheet: backdrop e saída curta; dialog com escala `0.98→1` em 250 ms, sheet deslizando da borda em 300 ms. O Base UI continua responsável pelo foco modal.
- Popover/dropdown/tooltip: fade e deslocamento de 4 px em 150 ms, saída em 100 ms, delay padrão de tooltip em 300 ms.
- Toast: Sonner desliza e esmaece com saída mais rápida; o ícone de status pulsa uma vez. Skeleton: shimmer existente e novo `SkeletonReveal` para crossfade ao conteúdo.
- `prefers-reduced-motion` e a chave `data-interface-motion="off"` removem o movimento sem alterar o estado final.

Verificação: typecheck isolado dos primitivos e dependências, ESLint dos arquivos tocados com `--quiet`, Vitest de primitivos (8 testes) e `git diff --check` passaram. O typecheck completo do repositório encontrou `TS1501` em `src/components/motion/count-up.tsx`, arquivo externo a esta alteração e não rastreado no momento. `agent:context` e `agent:verify --level fast` falharam antes de iniciar por `uv_os_get_passwd: ENOMEM`. Build não executado, conforme instrução do usuário.
