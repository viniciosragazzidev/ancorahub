# ERP operacional: relatório de passagem e prompt de continuação (13/11/2026)

Branch `codex/erp-foundation`, worktree `C:\Users\kyper\Desktop\Kyper\Projects\ancorahub-erp`. Nada foi enviado (sem push). Registro completo: `docs/implementations/active/2026-11-12-erp-operacional-execucao.md`. Decisões: DEC-183, DEC-184, DEC-185 e DEC-186 em `docs/decision-log.md`.

## 1. Relatório

### 1.1 Histórico
- **Codex:** fez a fundação do ERP (rotas reservadas, governança, implantação, importação e o primeiro fluxo financeiro). Parou em 12/11 às 19:13 por limite de uso, no meio de uma edição.
- **Claude:** conferiu esse estado, registrou-o no commit `8781ebe6` e concluiu o restante. Commits, do mais antigo ao mais novo:

| Commit | Conteúdo |
|---|---|
| `8781ebe6` | WIP do Codex conferido (tsc, lint, testes) |
| `23f3b8e4` | Comissões do cronograma, repasses com recibo, conciliação, indicações, incentivos |
| `5d1e3681` | Importação financeira, BI (produção/operadoras/crescimento/diário), metas, Modo TV, navegação |
| `15c656c5` | Assistente respondendo indicadores pelo catálogo, parâmetros do Modo TV, DEC-185 |
| `7514a1ba` | Botões de decisão que não enviavam o formulário, mensagens em pt-BR, QA visual |
| `fb0c2aff` | Revisão de regras, cargos e escala (ver 1.3) + kit de interface do ERP |

### 1.2 O que existe e funciona (commitado e testado)
- **Financeiro:** lançamentos conferidos com evidência e aprovação por outra pessoa, liquidação parcial, estorno compensatório, adiantamentos com compensação, fechamento de competência e caixa.
- **Comissões:** o cronograma legado (`commission_schedule`) entra no ERP para conferência, idempotente por parcela. As telas antigas não marcam como paga uma parcela controlada pelo ERP. A liquidação conferida atualiza o cronograma, nunca o contrário.
- **Repasses:** quatro etapas. Preparar → aprovar (outra pessoa, que não pode ser o beneficiário) → registrar pagamento com comprovante preso ao repasse (quem registra não pode ser quem aprovou) → conferir (outra pessoa). A conferência emite o recibo `RP-AAAA-NNNNNN`, imutável no banco, com código de integridade. O estorno de um pagamento de repasse mantém o vínculo e a comissão volta a ficar disponível.
- **Importações:** implantação e lançamentos financeiros por CSV/XLSX. A prévia é privada e a aplicação é feita por outra pessoa. O lançamento importado guarda o autor do arquivo como preparador, e uma referência já lançada é recusada.
- **Indicações:** deduplicação por telefone dentro do escopo; conversão só com venda real. Não cria lead (a titularidade está pendente).
- **Incentivos:** aprovação independente, apuração reproduzível (mesmos fatos → mesmo código), desempate determinístico, contestação registrada, sem gerar pagamento.
- **BI:** relatórios com catálogo de métricas e memória de cálculo. As telas novas ficam em `relatorios/(erp)`, fora do bloqueio do gestor do grupo `(legado)`.
- **Metas, TV e assistente:** metas em leitura. O Modo TV só mostra nomes com a política da empresa. O assistente responde indicadores antes do modelo, respeitando a chave do motor de IA.
- **Permissões:**
  - Tudo desligado por padrão: o Super-admin libera a plataforma e os módulos, e o Diretor ativa e escolhe os públicos por empresa.
  - O Gestor só abre os livros da corretora com a função Financeiro e um cargo delegado. Sem isso, vê na unidade apenas comissões e adiantamentos aprovados.
  - A visualização de suporte é somente leitura.
- **Escala:**
  - Acesso ERP resolvido uma vez por requisição (`loadErpBase` + `cache`).
  - Saldo em aberto calculado em SQL (`src/features/erp/balances.ts`).
  - Fila de conciliação ordenada por vencimento, com aviso de corte.
  - Índices na migration 0230 e no schema.
  - Testes com banco no projeto `db` do Vitest, sem paralelismo.
- **Verificação no último commit:**
  - `tsc` e ESLint limpos, build com `next build --webpack` ok.
  - 100 testes do ERP passando, incluindo cenários com Postgres isolado.
  - QA visual autenticado do repasse até o recibo.
  - Na suíte completa, 14 arquivos falham igualmente no branch de deploy sem o ERP; não são desta entrega.

### 1.3 Em andamento e NÃO commitado (padronização visual — DEC-186)
- **Regra:** toda tela do ERP passa a usar o kit `src/features/erp/ui/`:
  - `getErpSkin` escolhe a pele Lite ou a padrão.
  - `ErpPage`, `ErpList` (lista = tabela), `ErpPanel` (clique na linha abre o painel), `ErpRowMenu` (`⋯`), `ErpSettingsMenu` ("Configurações ▾"), `ErpUrlFilter`, `ErpMonthFilter`, `ErpPager`, `ErpSection`, `ErpNote`.
  - Um único botão principal por tela.
  - Busca com "+" (`SearchAddList`) para itens relacionados.
  - Sem `<details>` para ações.
- **Brief completo dos agentes:** `C:\Users\kyper\AppData\Local\Temp\claude\b284a423cb2ca29a\a99f8bc8-44bc-4ffb-9af7-c30600e3a738\scratchpad\ui-brief.md`. As regras estão resumidas no prompt abaixo.
- **Estado:**
  - Cinco agentes do Claude estavam refazendo as telas quando esta passagem foi escrita. Há cerca de 41 arquivos alterados ou novos sem commit.
  - Comissões, repasses, recibos e conciliação já estão migrados no disco.
  - Os demais grupos estão parcialmente editados: lançamentos/adiantamentos/fechamento/caixa; implantação/importações/governança; indicações/incentivos; relatórios/metas/TV.
- **Escopo pendente por grupo, além do visual:**
  - **Lançamentos:** busca de venda no novo lançamento em vez de um select com 200 vendas; escolhas de compensação só com saldo; filtros de data indexáveis no fechamento (`periodBounds`).
  - **Repasses:** paginação de `getPayouts`; seleção de comissões por busca; "Estornado depois da emissão" no repasse e no recibo.
  - **Importações:** validação em lote, sem consultas linha a linha; reenvio de arquivo rejeitado; busca de lote em toda a empresa.
  - **Indicações e incentivos:** mensagem clara no vínculo duplicado (índice único `erp_referrals_tenant_active_lead_unique`); nomes do ranking restritos ao escopo do gestor; trava `erp_incentive:` própria; filtros de data indexáveis; contestação por `entity_type`/`entity_id`; paginação.
  - **Relatórios e TV:** auditoria da TV no máximo uma vez por hora por pessoa; filtros de data indexáveis; `count(*)` onde a junção é 1:1; memória de cálculo num painel.

### 1.4 Ações humanas antes de publicar
1. Aplicar `drizzle/0230_erp_operational.sql` (aditiva; inclui índices em `sales` e `commission_schedule`), depois da 0228 e da 0229.
2. **Super-admin:** ligar o ERP e os módulos. **Diretor:** ativar cada módulo e escolher os públicos em `/administracao/erp`.
3. Criar cargos financeiros separando quem prepara de quem aprova. Ninguém recebe cargo automaticamente.
4. Decisões pendentes que seguem desligadas: DEC-004/DEC-012, regra da segunda parcela, alçadas, titularidade da indicação, regulamento de incentivo e exposição na TV.
5. Autorizar o push. O deploy sai do branch de feature mais novo.

### 1.5 Ambiente de teste
- **Postgres isolado:** `C:/Users/kyper/.codex/outputs/erp-postgres-2026-11-12`, somente `127.0.0.1:5442/erp_test`.
  - Iniciar: `pgsql/bin/pg_ctl.exe -D data-erp-test -o "-p 5442 -h 127.0.0.1" start`.
  - Nunca usar o `DATABASE_URL` de produção.
- **Testes:** `ERP_TEST_ROOT=<pasta acima> ERP_TEST_DATABASE_URL=postgres://erp_test@127.0.0.1:5442/erp_test npx vitest run src/features/erp`.
- **Build:** `npx next build --webpack`. O Turbopack recusa o `node_modules` ligado por link simbólico neste worktree.
- **QA visual:**
  - Rodar `next dev -p 3032 --webpack` no worktree, com `DATABASE_URL` e `SUPABASE_DB_URL` apontando para o banco isolado e `BETTER_AUTH_URL=http://localhost:3032`.
  - Empresa fictícia `erpqa-a`, usuários `director-a@`, `reviewer-a@` e `broker-a1@erp.example.invalid`.
  - Gerar uma senha de teste local nova (hash `better-auth/crypto`). A conta precisa de `issuer='local:credential'`.
  - O upload real de comprovante depende do R2 e não foi exercitado.

---

## 2. Prompt de continuação

> Copie o bloco abaixo para a próxima sessão (Codex ou Claude).

```
Você vai continuar o ERP operacional do CRM AncoraHub/CorreTop (Next.js App Router + Drizzle + Postgres, deploy no Coolify; NUNCA Vercel).
Trabalhe somente no worktree C:\Users\kyper\Desktop\Kyper\Projects\ancorahub-erp, branch codex/erp-foundation. Responda ao usuário em português do Brasil.

Leia primeiro, nesta ordem:
1. docs/implementations/active/2026-11-13-erp-handoff.md (este relatório)
2. CLAUDE.md (regras obrigatórias: design system, densidade, Coolify, fluxo de trabalho)
3. docs/design-system.md, seção "Product Density" e a exceção do Diretor Lite no fim
4. docs/decision-log.md: DEC-183 a DEC-186
5. src/features/erp/ui/erp-kit.tsx, erp-page.tsx, skin.ts (o kit obrigatório das telas)
6. src/features/erp/access.ts, shared.ts, balances.ts (acesso, utilitários e saldos em SQL)

Antes de editar:
- Rode `git status` e `git diff --stat`. Há cerca de 41 arquivos da padronização visual sem commit, parcialmente prontos.
- Pergunte ao usuário se os agentes do Claude ainda estão rodando nesse worktree. Se estiverem, não edite os mesmos arquivos.
- Confira cada arquivo alterado: termine o que estiver pela metade e não descarte trabalho alheio sem ler.

Tarefa: concluir a seção 1.3 do relatório (padronização visual + itens de escala e regra de cada grupo), sem mudar as regras de negócio já testadas.

Regras de interface (não negociáveis):
- Toda página do ERP usa ErpPage. Toda lista de entidades usa ErpList: uma tabela, e o clique na linha abre ErpPanel com o resumo e as ações.
- Ações secundárias ficam em ErpRowMenu (`⋯`) ou ErpSettingsMenu ("Configurações ▾"). Nunca use <details> para ações ou formulários.
- Um único botão principal por tela. Os demais são outline/ghost ou ficam em menus.
- Item relacionado se adiciona com busca + "+" (SearchAddList, busca no servidor), nunca com select de centenas de opções.
- Filtros e paginação vão pela URL (ErpUrlFilter, ErpMonthFilter, ErpPager).
- Nada de cor, raio, espaçamento ou tipografia fora dos tokens. Números alinhados à direita (numeric: true) e formatCents para valores.
- Toda tela cobre carregando, vazio, erro, módulo desligado e acesso negado. Dado ausente nunca vira zero.
- Botão dentro de formulário SEMPRE com type="submit" ou type="button": o Button padrão é type="button" e não envia nada.
- As duas peles precisam funcionar: padrão (Card overview + SectionCardHeader + DataTable, Sheet, DropdownMenu) e Lite (LiteResponsiveData, LiteSidePanel, LiteMenu). Não decida a pele na página: use o kit.

Regras de negócio e permissões (manter):
- Filtro de tenant e erpScopeSql/scopeIncludes em toda consulta.
- Aprovação por outra pessoa. O beneficiário não aprova, não paga nem confere o próprio valor. Quem aprova o repasse não registra o pagamento.
- Visualização de suporte somente leitura.
- O Gestor só vê os livros da corretora com função Financeiro e cargo delegado.
- Fatos aprovados são imutáveis; correção é sempre por evento compensatório.
- Valores conferidos com evidência, nunca inferidos. Registrar pagamento não faz transferência bancária.
- Decisões pendentes (segunda parcela, alçadas, DEC-004/012) continuam desligadas.

Manutenção:
- Use shared.ts e balances.ts em vez de duplicar helpers, e use constantes tipadas de status.
- Quebre linhas longas, sem funções de várias instruções numa linha só.

Verificação obrigatória antes de dizer que terminou:
- npx tsc --noEmit -p . sem erros; npx eslint nos arquivos do ERP limpo.
- Testes do ERP verdes contra o Postgres isolado (ver 1.5 do relatório; nunca outro banco).
- Teste de renderização de cada componente principal refeito, dentro de ErpSkinProvider com skin "standard" e com skin "lite".
- npx next build --webpack ok.
- QA visual das telas nas duas peles (ver 1.5).
- Atualize docs/implementations/active/2026-11-12-erp-operacional-execucao.md e docs/features-log.md.
- Faça commits pequenos por grupo no branch codex/erp-foundation, com mensagem em pt-BR.

Não faça push, não abra PR, não aplique migration em produção e não escreva no banco de produção.
Se algo depender de decisão do usuário, pare e pergunte, adotando a opção recomendada quando houver uma.
No fim, resuma em pt-BR o que ficou pronto, o que foi verificado e o que depende do usuário.
```
