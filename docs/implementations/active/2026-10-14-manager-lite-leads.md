# T124: Gestor Lite obrigatório, Leads primeiro

**Estado:** entrega parcial da migração gradual; pronta para revisão do T124.
**Decisão:** [DEC-141](../../decision-log.md#dec-141---gestor-obrigatoriamente-no-lite-com-leads-como-primeira-etapa).

## Escopo entregue

- Flag global `feature_manager_lite_enabled`, default false, governada pelo catálogo do Super-admin.
- Gestor com flag ativa recebe LIGHT antes de cookie/preferência; o servidor recusa NORMAL e a UI Lite não expõe a troca de modo.
- Allowlist exata e menu curto de Início, Leads, Notificações, Configurações e Primeiro acesso.
- Início usa a conversa "Leads da unidade". Radar e detalhe reutilizam a base Lite do supervisor.
- Consultas novas exigem tenant e unidade da sessão. Sem unidade, listas e buscas operacionais ficam vazias.
- Repasse chama `reassignLeadAction`, preservando validação de unidade, fila, eventos e auditoria existentes.
- Supervisores e corretores mantêm os respectivos caminhos atuais. Distribuição, escala e Meta seguem fora da experiência Lite do Gestor.
- Adendo T125: no desktop, a coluna lateral do gestor traz Início, Leads, Equipe, Notificações e Configurações; no mobile a navegação existente permanece igual.
- T125b: filtros por unidade do perfil, métricas e plantão aplicam-se só ao gestor; o supervisor mantém o escopo por `supervisorId`, inclusive sem unidade própria.

## Arquivos e fluxos

Catálogo de flags, `experience-mode`, `lite-audience`, `light-routes`, shell Lite,
layout autenticado, Dashboard, Leads, busca, radar/detalhe compartilhados,
consultas do Gestor, DEC-141, Controle UX e roadmap.

## Validações

- Vitest focado: 6 arquivos, 37 testes aprovados, incluindo modo, audiência,
  allowlist, flag, escopo de unidade e repasse auditado.
- `npm run type-check`: passou.
- ESLint nos arquivos alterados: passou sem erros; dez avisos preexistentes em
  páginas existentes.
- Build de produção omitido conforme instrução explícita do usuário por causa do
  junction externo de `node_modules`; nenhum teste de banco foi executado.

Evidência: `reports/agent/verification/2026-10-14-manager-lite-leads.md`.

## Limites e rollback

O Super-admin desliga `feature_manager_lite_enabled` para devolver imediatamente o
Gestor ao modo normal. A migração das demais ferramentas de gestão continua em
etapas. Testes de banco e QA visual autenticado não fizeram parte desta entrega.
