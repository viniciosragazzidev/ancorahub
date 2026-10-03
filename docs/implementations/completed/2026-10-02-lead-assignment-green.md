# Confirmação de atribuição em verde

## Escopo aprovado

Pedido do usuário: tornar verde o botão de confirmar atribuição no drawer do lead.
O rótulo existente é “Confirmar reatribuição” e foi preservado. Sem mudança de
regra de negócio, API, dados, permissão, dependência ou animação.

## Implementação

- `src/components/ui/button-variants.ts`: variante compartilhada `success`,
  derivada dos tokens `success`/`success-foreground`. O fundo é escurecido apenas
  no tema claro para garantir contraste, sem alterar os tokens globais.
- `src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx`:
  usa essa variante apenas no submit de reatribuição. Preserva condições de
  desabilitação, pending e o fluxo de oferta/atribuição direta existente.
- `src/components/ui/foundation-primitives.test.tsx`: cobertura da variante,
  semântica de submit, foco e estado desabilitado/pendente.
- `scripts/ui/verify-success-button.mjs`: QA local com Button e CSS reais em
  cenário sintético, sem autenticação, dados pessoais ou mutação de leads.

## Governança e auditoria

Refinamento visual da capacidade existente: continua sujeito à flag
`feature_lead_management_actions_enabled`, às permissões e às ações auditadas de
atribuição. Não cria uma capacidade operacional nova nem requer novo toggle.

## Validação

- QA sintético em Chromium passou nos temas claro/escuro, normal/hover, foco por
  teclado e botão desabilitado. Contrastes: 4,93:1 / 6,43:1 em light e
  10,03:1 / 8,41:1 em dark.
- Evidência: `reports/agent/verification/lead-assignment-green/results.json`,
  `light.png` e `dark.png`. Ambas inspecionadas visualmente.
- Harness fast passou: documentação, TypeScript e 1.360 testes (18 ignorados).
  Evidência: `reports/agent/verification/2026-10-02T17-10-39.061Z.md`.
- Teste isolado de `foundation-primitives`: 4/4 passaram, incluindo a variante verde.
- ESLint direcionado aos quatro arquivos de código/QA passou sem erros ou avisos;
  log: `reports/agent/verification/lead-assignment-green-targeted-lint.log`.
- Harness full: lint geral apontou uma referência inválida à regra
  `eslint(nextjs/no-img-element)` em `src/lib/pdf-primitives.tsx:248`. O mesmo
  comentário está no HEAD e o arquivo não tem alterações locais. Problema
  preexistente e externo ao CTA; preservado fora do escopo. Não há nova regressão
  crítica nos diagnósticos de arquitetura/segurança/desempenho (o drawer já é
  grande; esta mudança troca apenas sua variante).
- Build de produção passou, incluindo a geração da extensão. Harness full
  executou os nove gates: oito passaram (incluindo novamente 1.360 testes e build),
  apenas lint geral falhou pelo problema preexistente descrito acima.
  Evidência: `reports/agent/verification/2026-10-02T17-24-34.256Z.md` e
  `reports/agent/verification/lead-assignment-green-full.log`.
- `git diff --check` passou. N28 continua `partial` por pendências funcionais
  anteriores, independentes deste ajuste visual concluído.
- Não executada atribuição em ambiente autenticado: nenhuma regra foi alterada e
  a validação visual utiliza somente dados sintéticos.

## Riscos e rollback

Baixo risco, alteração restrita ao estilo de um CTA. Para reverter, restaurar sua
variante `outline`; a variante `success` não altera botões de outros tipos.
Alterações anteriores/paralelas da árvore de trabalho foram preservadas.
