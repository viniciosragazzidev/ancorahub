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

