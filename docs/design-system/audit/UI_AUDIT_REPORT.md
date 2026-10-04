# UI Audit Report

## Resumo executivo
Auditoria estática sem mudança de produção: 110 rotas, 364 componentes candidatos e 1419 itens para triagem.

## Inventário
| Métrica | Quantidade |
|---|---|
| Rotas | 110 |
| Componentes | 364 |
| Primitives centralizados | 85 |
| Famílias duplicadas | 20 |
| Achados | 1419 |
| Gaps | 3 |

## Principais famílias
| Família | Implementações | Canônico candidato | Recomendação |
|---|---|---|---|
| Card | 16 | src/components/ui/card.tsx | KEEP_AND_REFINE |
| Dialog | 13 | src/components/ui/dialog.tsx | KEEP_AND_REFINE |
| Table | 13 | src/components/ui/table.tsx | KEEP_AND_REFINE |
| Button | 9 | src/components/ui/button.tsx | KEEP_AND_REFINE |
| Select | 7 | src/components/ui/select.tsx | KEEP_AND_REFINE |
| Drawer | 7 | src/components/ui/drawer.tsx | KEEP_AND_REFINE |
| Sheet | 6 | src/components/ui/sheet.tsx | KEEP_AND_REFINE |
| Tabs | 6 | src/components/ui/tabs.tsx | KEEP_AND_REFINE |
| Badge | 5 | src/components/ui/badge.tsx | KEEP_AND_REFINE |
| Tooltip | 3 | src/components/ui/tooltip.tsx | KEEP_AND_REFINE |
| Toast | 3 | gap/ausente | DESIGN_GAP_OR_NEW_PRIMITIVE_REQUIRED |
| Input | 2 | src/components/ui/input.tsx | KEEP_AND_REFINE |

## Valores arbitrários
| Categoria | Ocorrências |
|---|---|
| ARBITRARY_COLOR | 19 |
| ARBITRARY_RADIUS | 23 |
| ARBITRARY_SPACING | 14 |
| ARBITRARY_TYPOGRAPHY | 790 |
| ARBITRARY_SHADOW | 38 |
| ARBITRARY_Z_INDEX | 9 |
| INLINE_STYLE | 75 |

## Riscos e gaps
- Foundations ainda têm DG-001 a DG-008; a auditoria não os resolveu.
- DataTable, FormField/controles e ownership de overlays são DG-009 a DG-011.
- Raw HTML, outline-none, valores arbitrários e elementos clicáveis não semânticos são evidências de REVIEW, não correções automáticas.

## Top 20 prioridades de triagem
1. ARBITRARY_COLOR — src/app/(auth)/verify/page.tsx:4 — Cor arbitrária deve ser confrontada com token semântico.
2. ARBITRARY_COLOR — src/app/(auth)/verify/page.tsx:7 — Cor arbitrária deve ser confrontada com token semântico.
3. ARBITRARY_COLOR — src/app/(auth)/verify/page.tsx:11 — Cor arbitrária deve ser confrontada com token semântico.
4. ARBITRARY_COLOR — src/app/page.tsx:43 — Cor arbitrária deve ser confrontada com token semântico.
5. ARBITRARY_COLOR — src/app/page.tsx:43 — Cor arbitrária deve ser confrontada com token semântico.
6. ARBITRARY_COLOR — src/app/page.tsx:470 — Cor arbitrária deve ser confrontada com token semântico.
7. ARBITRARY_COLOR — src/app/page.tsx:470 — Cor arbitrária deve ser confrontada com token semântico.
8. ARBITRARY_COLOR — src/app/page.tsx:488 — Cor arbitrária deve ser confrontada com token semântico.
9. ARBITRARY_COLOR — src/app/page.tsx:490 — Cor arbitrária deve ser confrontada com token semântico.
10. ARBITRARY_COLOR — src/app/page.tsx:493 — Cor arbitrária deve ser confrontada com token semântico.
11. ARBITRARY_COLOR — src/app/page.tsx:496 — Cor arbitrária deve ser confrontada com token semântico.
12. ARBITRARY_COLOR — src/app/page.tsx:600 — Cor arbitrária deve ser confrontada com token semântico.
13. ARBITRARY_COLOR — src/app/page.tsx:601 — Cor arbitrária deve ser confrontada com token semântico.
14. ARBITRARY_COLOR — src/app/page.tsx:604 — Cor arbitrária deve ser confrontada com token semântico.
15. ARBITRARY_COLOR — src/app/page.tsx:611 — Cor arbitrária deve ser confrontada com token semântico.
16. ARBITRARY_COLOR — src/app/page.tsx:611 — Cor arbitrária deve ser confrontada com token semântico.
17. ARBITRARY_COLOR — src/app/page.tsx:611 — Cor arbitrária deve ser confrontada com token semântico.
18. ARBITRARY_COLOR — src/app/page.tsx:619 — Cor arbitrária deve ser confrontada com token semântico.
19. ARBITRARY_COLOR — src/app/page.tsx:619 — Cor arbitrária deve ser confrontada com token semântico.
20. RAW_BUTTON — src/app/(auth)/2fa/page.tsx:88 — Botão nativo fora de primitive compartilhado; pode ser wrapper legítimo.

## Ondas recomendadas
Ver [MIGRATION_MAP.md](../MIGRATION_MAP.md). Nenhuma onda foi iniciada.

## Validação do inventário
A amostra de 10 rotas, 20 componentes e famílias está em [MANUAL_VALIDATION.md](./MANUAL_VALIDATION.md).

## Limitações
A análise é estática; não comprova equivalência visual ou elementos condicionais em runtime.
