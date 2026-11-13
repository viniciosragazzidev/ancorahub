# ERP operacional: execução ponta a ponta

Status: **módulos implementados e testados em ambiente isolado; não publicado**. Branch `codex/erp-foundation`, worktree `ancorahub-erp`. Escopo e decisões: DEC-183, DEC-184 e DEC-185; plano de produto em `docs/product/erp-operacional/`.

## Autorização e limites

O usuário solicitou executar o ERP operacional completo, aprovou valores conferidos com evidência e revisão independente, e autorizou PostgreSQL portátil isolado para testes. A regra da segunda parcela permanece desligada; nenhuma fórmula pendente de DEC-004/DEC-012 foi implementada. Cotador interno pausado, piloto existente preservado. Não houve instalação de dependências do CRM nem alteração do banco de produção.

Em 12/11, às 19:13, o Codex atingiu o limite de uso no meio do lote financeiro. O Claude conferiu o estado deixado (tsc, lint e testes), registrou-o no commit 8781ebe6 e concluiu os itens pendentes abaixo.

## Estado da execução

- [x] Fundação de rotas futuras bloqueadas, inventário de funcionalidades e matriz de públicos, commit c3fecd82.
- [x] Integração com o estado remoto de 12/11, preservando Venda Automatizada DEC-182; ERP renumerado para DEC-183.
- [x] Governança global e por empresa, perfis funcionais, versionamento, auditoria e módulos desligados por padrão. Parâmetros do Modo TV (nomes no ranking, segundos por tela) no painel de módulos.
- [x] Implantação: lista paginada, escopo, etapas, concorrência otimista, evidências privadas e reutilização de documentos aprovados.
- [x] Importação de implantação: CSV/XLSX limitado, prévia privada, hash, revisão independente, revalidação e aplicação atômica.
- [x] Fluxo financeiro: lançamento conferido, aprovação independente, evidência, liquidação parcial e estorno compensatório.
- [x] Integração com venda e cronograma: `/financeiro/comissoes` mostra previsto (cronograma), conferido (ERP) e pago ao corretor; "Conferir no ERP" traz as parcelas pendentes de uma venda como lançamentos a conferir, idempotente por parcela. As telas antigas não marcam como pago/não pago uma parcela controlada pelo ERP; a liquidação ou compensação conferida atualiza o cronograma (nunca o contrário).
- [x] Importação financeira: modelo próprio, cada linha vira lançamento a conferir (nunca aprovado ou pago), referência já lançada é recusada, aplicação por outra pessoa.
- [x] Recebíveis/mensalidades, despesas e fila de conciliação (sem evidência, a aprovar, movimentos a conferir, vencidos sem registro e divergências com o cronograma).
- [x] Repasses e recibos: preparar → aprovar (outra pessoa) → registrar pagamento com comprovante → conferir (outra pessoa). A conferência confirma as liquidações de todos os itens, atualiza o cronograma e emite recibo versionado (`RP-AAAA-NNNNNN`, código de integridade). Corretor vê só os próprios recibos. Repasse liquidado é imutável no banco.
- [x] Adiantamentos/compensações, caixa e fechamento (entregues pelo Codex; compensação agora bloqueada enquanto a comissão está em um repasse em andamento).
- [x] Indicações: cadastro com consentimento, deduplicação escopada por telefone (fora do escopo responde sem revelar dados), etapas com versão, vínculo a negócio existente e conversão só com venda real.
- [x] Incentivos: campanha com regulamento, aprovação independente, apuração prévia/final reproduzível (mesmos fatos e versão → mesmo código), desempate determinístico, política de exposição de nomes e contestação registrada.
- [x] BI: `/relatorios/producao`, `/operadoras`, `/crescimento`, `/diario` com catálogo de métricas (memória de cálculo), escopo do servidor e valores ocultos para quem não pode vê-los. As telas novas ficam no grupo `(erp)`, fora do bloqueio do gestor que vale para o restante de `/relatorios` (grupo `(legado)`).
- [x] Metas (leitura das metas existentes no escopo) e Modo TV (`/tv`, rotação, pausa, tela cheia, atualização a cada 5 min, nomes só com política da empresa).
- [x] Assistente analítico: perguntas sobre vendas, valor vendido, canceladas, implantações e recebido são respondidas pelo catálogo de métricas no escopo de quem pergunta, antes do modelo de IA; o modelo não recebe dados e nenhum SQL vem do texto. "Confirmada" é tratada como ambígua.
- [x] Navegação: área "Operação ERP" com indicações, metas, incentivos e TV; títulos no shell Lite; rotas protegidas no proxy.
- [x] QA visual autenticado no servidor local contra o banco isolado, com usuários fictícios (diretor, revisor e corretor):
  - Comissões: conferir o cronograma no ERP.
  - Repasse completo: preparar → aprovar por outra pessoa → registrar pagamento → conferir → recibo RP-2026-000001.
  - Recibo aberto pelo próprio corretor.
  - Bloqueio do corretor em recebíveis, conciliação e governança.
  - Telas de indicações, produção e Modo TV.
  - Assistente respondendo indicador.
  - Painel de módulos com os parâmetros da TV.
  - O QA achou e corrigiu: botões de decisão que não enviavam o formulário (inclusive aprovação de lançamento, liquidação e compensação), mensagens de validação em inglês e rótulo de mês.
  - O upload real de comprovante não foi exercitado, porque depende do R2; o comprovante foi cadastrado direto no banco de teste.
- [ ] Roteiro de migração, ativação de piloto e revisão final de publicação (ações humanas abaixo).

## Verificação

- `tsc` sem erros; ESLint limpo nos arquivos do ERP.
- 97 testes do ERP passam (unitários e cenários reais contra o Postgres isolado). Os arquivos `*-db.test.ts` compartilham a configuração global de módulos: rodar com `npx vitest run src/features/erp --no-file-parallelism`.
- Suíte completa: 5.460 testes passam; 14 arquivos falham igualmente no branch de deploy `feat/diretor-visual-lite` sem o ERP (conferido numa cópia limpa), sem relação com esta entrega.
- Cenários com banco cobertos: isolamento entre empresas, escopo de corretor/supervisor/gestor, autoaprovação recusada em lançamento, liquidação, repasse, pagamento de repasse, importação e campanha; idempotência por `request_id`; conflito de versão; imutabilidade de eventos, recibos e apurações; cronograma antigo sincronizado e bloqueado.

## Ações humanas antes de publicar

1. Aplicar a migration `drizzle/0230_erp_operational.sql` (aditiva) no banco de produção, depois da 0228/0229 da Venda Automatizada.
2. Super-admin: ligar o ERP e os módulos desejados; Diretor: ativar cada módulo e escolher os públicos em `/administracao/erp`.
3. Criar cargos com as capacidades ERP separando preparo e aprovação financeira (ninguém recebe cargo automaticamente).
4. Decisões ainda pendentes (DEC-004/DEC-012, segunda parcela, alçadas, titularidade de indicação, regulamento de incentivo, exposição na TV) seguem desligadas ou manuais.

## Ambiente isolado e lacunas conhecidas

PostgreSQL 16.16 em `C:/Users/kyper/.codex/outputs/erp-postgres-2026-11-12`, somente `127.0.0.1:5442/erp_test`. Origem e SHA-256 em `provenance.json`. O preparador só aceita essa URL e verifica o diretório real do servidor antes de recriar dados sintéticos. Nenhum fallback para variáveis de produção.

O gerador do esquema legado tem CHECK com regex truncada por ponto e vírgula e nomes duplicados de constraint/índice. O preparador restaura a expressão exata do snapshot e elimina apenas índices redundantes sobre as mesmas colunas na fixture. O pgvector não está disponível nessa distribuição; somente na fixture o tipo é convertido em `real[]`. Recursos de IA vetorial não foram testados nem alterados.

O worktree usa `node_modules` do checkout principal por link simbólico; o Turbopack recusa esse link no `next build`, então o build local foi feito com `next build --webpack`. No Coolify a instalação é normal e o problema não se aplica.

Indicações: a visualização de suporte (view-as) não abre a tela, porque a única capacidade do módulo é de gestão; criar uma capacidade só de leitura se o suporte precisar. Não há índice único no banco para contato ativo repetido; a deduplicação usa trava transacional por telefone.
