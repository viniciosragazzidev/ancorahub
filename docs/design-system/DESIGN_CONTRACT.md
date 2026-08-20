# Contrato de Design System

**Status:** ACTIVE  
**Versão:** 1.1.0  
**Fonte de verdade:** este contrato e documentos ligados; `design.md` é a fonte de evidência visual inicial. Em conflito, uma lacuna documentada impede nova regra até decisão aprovada.

## Escopo e não escopo

Aplica-se a foundations, primitives compartilhados, padrões genéricos, conteúdo de interface e revisão de qualidade. Não contém fluxo comercial, papéis, estados de lead, regras de tenant ou integrações; estes pertencem a features e documentação de produto.

## Princípios

| ID | Prioridade | Regra | Aplicar | Evitar | Validação |
|---|---:|---|---|---|---|
| DS-001 | P0 | Usar tokens semânticos e primitives compartilhados. | `Button`, `Input`, `Card` e tokens centrais. | hex, medidas e controles duplicados na página. | revisão de diff e busca por valores arbitrários. |
| DS-002 | P0 | Uma superfície operacional deve revelar contexto, prioridade e próximo passo. | título, ação primária e estado. | cards decorativos e CTAs sem consequência. | revisão por cenário de usuário. |
| DS-003 | P0 | Estado não pode depender só de cor ou motion. | texto, ícone, foco e feedback. | cor sem rótulo/semântica. | teclado, contraste e leitor de tela. |
| DS-004 | P0 | Evidência vence estética. | usar somente valores CONFIRMED. | preencher MISSING com preferência pessoal. | consulta a tokens e gaps. |
| DS-005 | P1 | Interfaces permanecem calmas e legíveis. | superfícies claras, bordas discretas, CTA escura. | gradientes, muitas cores cromáticas, sombras pesadas. | inspeção contra foundations. |
| DS-006 | P1 | Responsividade e acessibilidade são requisitos de saída. | estados, teclado, foco, reflow e reduced motion. | considerar desktop feliz como pronto. | checklist de acessibilidade. |

## Regras inegociáveis

1. Não criar token, primitive, variante ou padrão novo sem regra existente ou gap resolvido.
2. Não usar `design.md` para inferir regra de negócio, status comercial ou permissão.
3. Não tratar a referência de landing page como especificação pronta de dashboard operacional.
4. Toda implementação que divergir deste contrato deve documentar motivo, impacto, aprovação e plano de convergência.
5. Qualquer alteração de foundation ou primitive exige estados relevantes, responsividade e acessibilidade.
6. **Toda página nova ou refatorada deve declarar um Pattern Blueprint registrado** antes de sua implementação. Páginas não são compostas do zero: devem usar o blueprint aplicável, registrar exceção justificada ou abrir um gap de pattern.

## Fundamentos, componentes e padrões

- Foundations e tokens: [FOUNDATIONS.md](./FOUNDATIONS.md) e `tokens/`.
- Taxonomia e governança de componentes: [COMPONENT_RULES.md](./COMPONENT_RULES.md).
- Padrões de página: [PAGE_PATTERNS.md](./PAGE_PATTERNS.md) e [patterns/](./patterns/README.md).
- Regras complementares: [RESPONSIVE_RULES.md](./RESPONSIVE_RULES.md), [ACCESSIBILITY_RULES.md](./ACCESSIBILITY_RULES.md), [MOTION_RULES.md](./MOTION_RULES.md), [CONTENT_RULES.md](./CONTENT_RULES.md).

## Exceções e mudança

Uma exceção é temporária, rastreável e não cria precedente. Registre: regra/ID afetado, motivo, superfície, alternativa avaliada, risco, responsável, data de expiração e plano de remoção.

Mudanças usam semver: **patch** esclarece texto sem mudar regra; **minor** adiciona regra compatível; **major** muda ou remove contrato. Toda mudança deve atualizar auditoria, token/padrão afetado, `.agent/design-contract.json`, changelog e registro de implementação.

## Validação do contrato

| Pergunta | Resposta v1.0.0 |
|---|---|
| Qual é a fonte de verdade? | Este contrato; `design.md` fornece evidência inicial. |
| Posso usar novo hex? | Não; abra gap ou use token existente. |
| Qual fonte usar? | Open Runde, quando disponível; fallback é MISSING. |
| Qual espaçamento usar? | Escala confirmada em `tokens/spacing.md`. |
| Qual raio usar? | Apenas após resolver DG-003 para o caso; não inventar. |
| Como é botão destrutivo? | MISSING: não criar variante visual nova. |
| Como é uma tabela? | Pattern genérico; primitive detalhado é MISSING. |
| Como reflow funciona? | MISSING: preservar comportamento existente até decisão. |
| Qual motion usar? | Tokens atuais do projeto e reduced motion; escala da referência é MISSING. |
| O que fazer se faltar regra? | Registrar/usar [DESIGN_GAPS.md](./DESIGN_GAPS.md). |

## Changelog

### 1.1.0 — 2026-08-20

Blueprints de página tornaram-se obrigatórios para páginas novas ou refatoradas; registry, estados e contrato de interação foram adicionados sem migração de rotas.

### 1.0.1 — 2026-08-20

Inventário de UI anexado ao contrato: gaps DG-009 a DG-011 registrados sem alteração de regra visual ou runtime.

### 1.0.0 — 2026-08-20

Contrato inicial derivado de `design.md`, com evidência, divergências e gaps explícitos; nenhuma UI foi migrada.
