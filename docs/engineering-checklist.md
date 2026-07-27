# Checklist de Engenharia

## Antes de iniciar uma feature

- [ ] Domínio, use cases, services e repository escopado definidos; a interface não possui regra de negócio própria.
- [ ] Foi decidido como a capacidade funciona em modo completo e modo contextual/plugin.
- [ ] Eventos publicados/escutados, feature flag e superfície de governança do Super-admin definidos.
- [ ] A feature responde às perguntas do pre-flight Plugin First em `docs/plugin-first-architecture.md`.
- [ ] Requisito/RF e regras de negocio afetadas identificados.
- [ ] Nao ha decisao bloqueante pendente para o comportamento proposto.
- [ ] Rota, dominio e contrato de dados definidos sem misturar UI e regra de negocio.
- [ ] Componentes existentes em `src/components/ui/` e `src/components/unlumen-ui/` avaliados antes de criar controles.
- [ ] Documentacao local da versao instalada do Next.js consultada.
- [ ] Nenhuma dependencia nova e necessaria sem autorizacao explicita.
- [ ] Dados pessoais, LGPD, tenant e permissoes avaliados.

## Antes de considerar pronta

- [ ] Entradas externas validadas no servidor.
- [ ] Autorizacao, tenant e escopo de responsavel/filial aplicados no servidor.
- [ ] Operacoes sensiveis registram auditoria sem vazar conteudo.
- [ ] Logica critica testavel de modo deterministico e testes adequados incluidos.
- [ ] Interface possui estados de carregamento, vazio, erro e permissao quando aplicavel.
- [ ] Controles e estilos repetiveis usam componentes/tokens shadcn/Unlumen compartilhados.
- [ ] Interface segue `DESIGN.md`, e navegavel por teclado e nao usa apenas cor para estado.
- [ ] Regras, decisoes e ADRs atualizados quando comportamento/arquitetura mudou.
- [ ] Codigo passa por lint, type-check, testes e build disponiveis.
- [ ] `npm run build` foi executado e passou antes da entrega.
- [ ] Alteracao pequena, coesa e commit segue Conventional Commits.
- [ ] Item correspondente de `/roadmap` atualizado com status, descricao da implementacao,
  resumo tecnico, arquivos/fluxos afetados e validacoes executadas.
- [ ] Status `done` usado somente quando o escopo estiver completo; entregas incompletas usam
  `partial` e registram claramente o trabalho restante.
- [ ] Mutações interativas têm feedback otimista, rollback e invalidação/reconciliação
  após a resposta do servidor.
- [ ] Cache local usa chaves com `tenantId` e `userId`; estados local/confirmado/erro
  usam tokens semânticos compatíveis com claro e escuro.
## Pre-flight de UX e carga cognitiva

### Antes de iniciar

- [ ] Papel, objetivo, tarefa principal e proximo passo do usuario estao definidos.
- [ ] Rota, permissao e prontidao real do modulo foram verificadas.
- [ ] `docs/ux-audit-2026-07-13.md` e os padroes existentes foram consultados.
- [ ] A hierarquia foi reduzida a uma acao principal e no maximo tres prioridades.

### Antes de considerar pronta

- [ ] Nao existem badges, contadores ou status estaticos/ficticios.
- [ ] Nao existem botoes sem acao, links quebrados ou promessas sem suporte.
- [ ] Navegacao e comandos aparecem somente para o papel/permissao correto.
- [ ] A busca anuncia exatamente o escopo que pesquisa e retorna.
- [ ] Carregamento, vazio, erro, sucesso, permissao negada e indisponibilidade foram tratados.
- [ ] O proximo passo e o resultado da acao estao claros sem depender de hover ou memoria.
- [ ] Abas, filtros e contexto recuperam URL quando necessario para retorno e suporte.
- [ ] Terminologia e status seguem o glossario/taxonomia vigente.
- [ ] Dados sensiveis usam minimizacao, confirmacao contextual, auditoria e desfazer quando possivel.
- [ ] Foi verificado teclado, foco, semantica, contraste, zoom, viewport estreito e reduced motion.
- [ ] Fluxos principais foram validados por cenarios sinteticos ou a limitacao foi registrada.
