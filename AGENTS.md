<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras do projeto CorreTop

Leia e siga `AI_RULES.md` antes de qualquer alteração. Os documentos de produto e
engenharia ficam em `docs/`; o índice e a ordem de precedência estão em
`docs/README.md`.

Regras inegociáveis:

- Antes de qualquer implementação, leia integralmente `.agents/skills/grill-with-docs/SKILL.md` e siga suas orientações para validar o plano, o domínio e as decisões documentais antes de escrever código.
- Não instale, atualize ou remova dependências sem solicitação explícita.
- Antes de escrever código Next.js, leia a documentação correspondente em
  `node_modules/next/dist/docs/`.
- Trate todo acesso a dados como multi-tenant: nenhuma query ou ação poderá
  depender de um `tenant_id` enviado pelo cliente.
- Valide toda entrada externa no servidor e registre auditoria para operações
  que envolvam dados pessoais, sensíveis, exportações ou permissões.
- Não implemente uma regra marcada como pendente em `docs/decision-log.md` sem
  registrar a decisão aprovada.
- Para trabalho de interface, siga `docs/ui-foundation.md`: consulte primeiro o MCP
  do shadcn e a documentação do Unlumen. O shadcn é obrigatório, com
  `dashboard-01` como fundação para superfícies de dashboard; use `transitions-dev`
  para qualquer transição ou animação nova.
- Sempre reutilize componentes e tokens existentes em `src/components/ui/` e
  `src/components/unlumen-ui/`. Não crie variações locais de
  botões, campos, cards, tipografia, espaçamento ou estados que já tenham equivalente
  compartilhado; primeiro evolua a variante do componente-base.
- **Controle pelo Super-Admin e Auditabilidade**: Todas as implementações daqui para frente devem ser auditáveis (gerar logs de auditoria apropriados), editáveis (parâmetros configuráveis) e passíveis de serem ativadas/desativadas pelo super-admin a qualquer momento.

## Engineering Harness

`docs/agent/README.md` é a porta de entrada operacional para tarefas de engenharia.
Antes de editar, carregue o contexto mínimo indicado por `npm run agent:context --
--task "<objetivo>"`; carregue documentos de módulo somente quando a mudança os
atingir. Use `npm run agent:verify -- --level fast` durante ciclos curtos e `--level
full` antes de encerrar. Não declare conclusão sem evidência registrada em
`reports/agent/verification/` e sem atualizar o registro de implementação aplicável.

O harness é deliberadamente progressivo: suas verificações arquiteturais, de segurança
e desempenho começam diagnósticas. Uma nova regressão crítica deve ser corrigida ou
justificada no registro da implementação; não use o diagnóstico para ignorar dívida
preexistente nem para bloquear indiscriminadamente o trabalho em produção.

## DESIGN SYSTEM CONTRACT RULES

- A fonte de verdade do design system é `docs/design-system/DESIGN_CONTRACT.md`.
- Antes de qualquer mudança de UI, consulte o contrato, foundations/tokens, regras de componentes e o padrão aplicável.
- Não invente token, primitive ou variante: registre e resolva um gap em `docs/design-system/DESIGN_GAPS.md` antes de institucionalizar a regra.
- Documente qualquer divergência entre contrato e implementação, com motivo, impacto e plano de convergência.
- O design system não contém regras de negócio; estados, permissões, tenant e fluxos pertencem às features e à documentação de domínio.
- Estados relevantes, responsividade e acessibilidade são obrigatórios em toda mudança de interface.
- Toda página nova ou refatorada deve declarar e seguir um Pattern Blueprint de `docs/design-system/patterns/`; não componha uma página do zero sem exceção documentada ou gap aprovado.

