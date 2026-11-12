# ERP operacional: execução ponta a ponta

Status: **em implementação, não publicado**. Branch `codex/erp-foundation`, worktree `ancorahub-erp`. Escopo e decisões: DEC-183 e DEC-184; plano de produto em `docs/product/erp-operacional/`. A fundação anterior não representa a entrega dos módulos.

## Autorização e limites

O usuário solicitou executar o ERP operacional completo, aprovou valores conferidos com evidência e revisão independente, e autorizou PostgreSQL portátil isolado para testes. A regra da segunda parcela permanece desligada; nenhuma fórmula pendente de DEC-004/DEC-012 foi implementada. Cotador interno pausado, piloto existente preservado. Não houve instalação de dependências do CRM nem alteração do banco de produção.

## Estado da execução

- [x] Fundação de rotas futuras bloqueadas, inventário de funcionalidades e matriz de públicos, commit c3fecd82.
- [x] Integração com o estado remoto de 12/11, preservando Venda Automatizada DEC-182; ERP renumerado para DEC-183.
- [x] Governança global e por empresa, perfis funcionais, versionamento, auditoria e módulos desligados por padrão.
- [x] Implantação: lista paginada, escopo, etapas, concorrência otimista, evidências privadas e reutilização de documentos aprovados.
- [x] Importação de implantação: CSV/XLSX limitado, prévia privada, hash, revisão independente, revalidação e aplicação atômica.
- [x] Primeiro fluxo financeiro: lançamento conferido, aprovação independente, evidência, liquidação parcial e estorno compensatório. Serviços testados; interface ainda em validação.
- [ ] Integração completa com registro de venda e cronograma legado, incluindo prevenção de mutações divergentes.
- [ ] Importação financeira, conciliação completa e cadastros financeiros complementares.
- [ ] Repasses, recibos pessoais, adiantamentos/compensações, caixa e fechamento.
- [ ] Metas/incentivos, indicações, BI, assistente e TV.
- [ ] Navegação nos modos existentes, modelos de cargos e revisão da matriz final de acesso.
- [ ] QA autenticado de interface, revisão completa, build e harness final.
- [ ] Roteiro de migração, ativação de piloto e revisão final de publicação.

## Evidências já executadas

Arquivos em `reports/agent/verification/` (artefatos locais, não versionados):

- `erp-core-tests.log`: 42 testes de contratos, escopos, rotas e acesso efetivo aprovados antes das extensões financeiras.
- `erp-parser-and-driver-tests.log`: 15 testes de parsing CSV/XLSX, limite real do corpo HTTP e driver PostgreSQL local aprovados.
- `erp-local-schema.log`: esquema sintético com 225 tabelas carregado e SQL 0230 aplicado em PostgreSQL 16.16 local.
- `erp-operational-db-tests.log`: cinco cenários reais aprovados: isolamento/escopo, concorrência otimista, importação idempotente e revisão, liquidação concorrente com estorno e auditoria imutável.
- `erp-pool-repro.log` e `erp-pool-instrumented.log`: reprodução anterior da exaustão do pool nas autorizações fora da transação; corrigida passando a mesma conexão à resolução canônica de permissões/escopo. O teste concorrente passou após a correção.

Os testes de serviço fornecem uma identidade sintética ao adaptador de sessão. Permissões de cargos, consultas e transações usam o banco real. Não substituem o QA HTTP/BetterAuth ou o armazenamento de arquivos, ainda pendentes.

## Ambiente isolado e lacunas conhecidas

PostgreSQL 16.16 em `C:/Users/kyper/.codex/outputs/erp-postgres-2026-11-12`, somente `127.0.0.1:5442/erp_test`. Origem e SHA-256 em `provenance.json`. O preparador só aceita essa URL e verifica o diretório real do servidor antes de recriar dados sintéticos. Nenhum fallback para variáveis de produção.

O gerador do esquema legado tem CHECK com regex truncada por ponto e vírgula e nomes duplicados de constraint/índice. O preparador restaura a expressão exata do snapshot e elimina apenas índices redundantes sobre as mesmas colunas na fixture. O pgvector não está disponível nessa distribuição; somente na fixture o tipo é convertido em `real[]`. Recursos de IA vetorial não foram testados nem alterados.

Manifesto declara Next 16.4.5 e a instalação compartilhada contém 16.2.10. Não houve atualização autorizada de pacotes. O arquivo `docs/ux-audit-2026-07-13.md`, citado nas regras, não existe no checkout. Preservado o contrato visual e UX-M1.10; não há novo token ou animação local.
