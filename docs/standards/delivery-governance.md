# Governança de implementação, revisão e deploy

## Pré-flight obrigatório

Antes de escrever código:

1. Ler `AI_RULES.md`, `AGENTS.md`, `docs/README.md`, `docs/decision-log.md`, `docs/business-rules.md`, `CONTEXT.md` e o padrão aplicável.
2. Identificar papel, tenant, unidade, dado sensível e regra de negócio afetada.
3. Descrever estado atual, risco, escopo, dependências, rollback e critério de conclusão.
4. Verificar se a decisão está aprovada; pendência em `decision-log.md` bloqueia implementação.
5. Procurar componente, módulo e adapter existentes antes de criar outro.

## Durante a implementação

- Um commit deve ter intenção única e seguir Conventional Commits.
- Não misturar reorganização de arquivos com mudança funcional sem separar commits.
- Migrations, schema, actions, queries, testes e documentação entram juntos quando formam uma unidade.
- Toda feature nova é auditável, configurável e desativável pelo Super-admin quando a regra do projeto exigir.
- Nenhuma dependência nova sem solicitação explícita e decisão de custo/manutenção.
- Atualizar regras, ADRs e roadmap imediatamente quando a implementação alterar comportamento ou arquitetura.

## Migrations

1. Alterar schema fonte.
2. Gerar migration Drizzle versionada.
3. Revisar SQL, índice, lock, default, nullability e compatibilidade com dados existentes.
4. Tornar a migration segura para deploy gradual quando possível: expandir, migrar dados, trocar leitura, contrair.
5. Testar em banco sintético/staging antes de produção.
6. Nunca editar migration já aplicada para “corrigir histórico”; criar a próxima.
7. Documentar rollback ou a razão de uma operação irreversível.

## Revisão

O autor verifica:

- tenant/authorization em todas as queries e mutations;
- entrada/saída e erros;
- loading/empty/error/success/denied/unavailable;
- acessibilidade e responsividade;
- performance e N+1;
- auditoria, observabilidade e feature flag;
- docs e roadmap;
- impacto em integrações, jobs e dados históricos.

## Validação mínima

```text
npm run lint
npm run type-check
npm test
npm run build
```

Se um comando não puder ser executado, registrar motivo, risco e validação alternativa; não declarar `done` silenciosamente.

## Deploy

- Preview valida mudança isolada com dados sintéticos.
- Produção exige commit identificável, build verde, variáveis de ambiente conferidas e migration aplicada na ordem correta.
- Após publicar, validar healthcheck, login, rota alterada, integração crítica e logs.
- Registrar URL/ID do deploy, resultado e rollback disponível.
- Cron não deve ser tratado como confiável apenas porque o deploy foi aceito; verificar execução e atraso.

## Reorganização de arquivos

- Medir antes: imports, dependências, tamanho, testes, runtime e owners.
- Mover por domínio em lote pequeno.
- Manter adapter temporário quando links externos/rotas ainda dependem do caminho antigo.
- Não alterar comportamento, contrato público ou dados no mesmo commit de movimento.
- Remover caminho antigo apenas após type-check, testes, build e busca de referências.
