# Corretores desativados na escala de plantão

## Escopo aprovado

O usuário confirmou que a inclusão deve aceitar também cadastros desativados,
não apenas corretores offline. DEC-130 / BR-029W distinguem participação na escala
de elegibilidade para receber leads. Nenhum cadastro é reativado automaticamente.
Mantidos tenant, vínculo existente, cargo/papel, escopo de unidade, permissão,
conflitos de horário, capacidade, transação e auditoria. Contas pendentes e vínculos
excluídos continuam fora. Não há migration nem dependência nova.

## Implementação

- `roster-broker-account-filter.ts`: filtro canônico somente para planejamento,
  condicionado à flag global `DUTY_INACTIVE_BROKERS` (padrão habilitado).
- `roster-queries.ts` e `roster-actions.ts`: seleção e validação de inclusão/movimento
  compartilham a mesma política, evitando liberar só o dropdown.
- `monthly-duty-actions.ts`: geração, inclusão manual e publicação mensal usam
  a mesma política; mantidos vínculos e unidades ativas exigidos nesse fluxo.
- `monthly-duty-planner.tsx`: texto de vazio não afirma que apenas ativos são aceitos.
- `shared/feature-flags/catalog.ts`, `super-admin/actions.ts` e `settings/page.tsx`:
  controle independente “Permitir cadastros desativados na escala”, dentro do card
  “Planejamento e inclusão em plantões”. Escrita validada, restrita ao Super-admin
  e auditada; desativação não apaga escalas existentes.
- Filtros do motor de distribuição, roster operacional e presença permanecem
  inalterados: desativado não passa a receber leads por estar na escala.

## Validação

- Testes antes da correção: lista omitia cadastro desativado e ação recusava
  a inclusão. Evidência: `reports/agent/verification/roster-inactive-red.log`.
- Dez testes de consulta/ação/política passaram, além dos nove do WhatsApp mobile.
  Evidência: `reports/agent/verification/roster-and-whatsapp-green.log`.
- O teste executa o SQL gerado pelo Drizzle contra um executor sintético dos
  predicados usados. Não abre conexão real nem altera cadastros/plantões reais;
  não substitui uma homologação com PostgreSQL e usuário autenticado.
- Harness fast passou: `reports/agent/verification/2026-10-02T19-31-39.095Z.md`.
  A suíte conjunta passou com 1.384 testes (18 ignorados); type-check passou.
- Lint focado: zero erros e três avisos preexistentes no conjunto das duas tarefas
  (`reports/agent/verification/roster-and-whatsapp-targeted-lint.log`).
- Harness full: oito etapas passaram, incluindo type-check, testes e build.
  Evidência: `reports/agent/verification/2026-10-02T19-43-10.334Z.md` e log
  `reports/agent/verification/roster-and-whatsapp-full.log`. O resultado global
  permanece com falha apenas no lint, pelo erro preexistente de regra inexistente
  `eslint(nextjs/no-img-element)` em `src/lib/pdf-primitives.tsx:248`.
- O novo controle usa Checkbox compartilhado. Lint da página final passou sem
  erros/avisos: `reports/agent/verification/roster-admin-control-lint.log`.
- Diagnósticos arquiteturais/desempenho sinalizam tamanho de arquivos já grandes;
  a política nova foi extraída para módulo server-only pequeno. O alerta heurístico
  de tenant no arquivo global de ações do Super-admin não se aplica à ação nova:
  ela exige platform-admin, valida apenas um booleano e não recebe tenantId.

## Riscos e rollback

Desligar `feature_duty_inactive_brokers_enabled` restaura os filtros de cadastro
ativo para novas inclusões/edições/publicações. Escalas atuais permanecem para
consulta/remoção. O controle é global e auditável; não altera outras flags.
Alterações anteriores e paralelas da árvore de trabalho foram preservadas.
