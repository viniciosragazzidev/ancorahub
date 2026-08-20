# Token Usage

Auditoria estática em 862 arquivos de código de frontend. Um achado é evidência para revisão, não erro automático.

| Categoria | Ocorrências | Classificação inicial |
|---|---|---|
| ARBITRARY_COLOR | 19 | MIGRATE_TO_TOKEN |
| ARBITRARY_RADIUS | 23 | REVIEW |
| ARBITRARY_SPACING | 14 | REVIEW |
| ARBITRARY_TYPOGRAPHY | 790 | REVIEW |
| ARBITRARY_SHADOW | 38 | REVIEW |
| ARBITRARY_Z_INDEX | 9 | REVIEW |
| INLINE_STYLE | 75 | REVIEW |

## Comparação com o contrato

- Cores, raio, sombra, motion, breakpoints e z-index arbitrários confrontam DS-001/CR-003; radius/z-index também dependem de DG-003/DG-007.
- Valores existentes em `globals.css` são camada de implementação e não equivalem automaticamente aos tokens v1.0.0.
- Cada ocorrência com arquivo, linha, regra, razão e confiança está em [ui-inventory](../../../.agent/ui-inventory.json).
