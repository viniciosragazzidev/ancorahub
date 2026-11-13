# ERP operacional da Âncora

Estado: planejamento funcional concluído; fundação técnica local implementada, com validação global limitada no registro da entrega. Os módulos novos continuam planejados. Data: 2026-11-12.

## Escopo confirmado

Vinicios pediu a pausa do desenvolvimento do cotador interno e a expansão do AncoraHub para ERP. A pausa não desliga o piloto publicado. Confirmou nesta sessão:

1. ERP operacional primeiro: comercial, implantação, financeiro, comissões, pessoas/metas, incentivos, indicações, BI e administração. Fiscal, folha e emissão de notas ficam para etapa posterior.
2. Separar contrato implantado, mensalidade paga pelo cliente e comissão recebida pela Âncora. A condição da LP de contar a partir da segunda parcela não foi adotada; nenhuma fórmula financeira atual deve mudar por inferência.

O objetivo é aproveitar o CRM existente e ligar o fechamento comercial à operação e ao dinheiro efetivamente movimentado. Não é duplicar o produto inteiro em um novo shell.

## Evidência e limites da comparação

Fonte primária: [LP pública New Master BI](https://newmasterbi.com/), consultada em 2026-11-12. Extração renderizada via Firecrawl; o único destino público funcional anunciado é `/login`. A página não fornece documentação dos campos, algoritmo, banco ou telas internas. Os itens abaixo são promessas da LP, não funcionalidades internas comprovadas em teste. Não houve acesso à conta desse fornecedor.

Comparação local: branch `codex/erp-foundation`, base `eb5e2938` de `origin/feat/diretor-visual-lite`. A presença de arquivo não prova publicação, governança completa ou operação ponta a ponta. “Parcial” significa base encontrada com lacunas identificadas. “Não localizado” é resultado da inspeção das rotas, serviços e schema relevantes, não prova de ausência em outro ambiente.

## Inventário integral da LP e lacunas

| ID | Capacidade anunciada | Evidência local e diferença a resolver |
|---|---|---|
| LP-01 | Painel com atualização dos dados da operação | Dashboard, relatórios e sincronização já existem. Definir frescor por métrica, estado desatualizado e atualização após eventos financeiros. |
| LP-02 | Produção por vendedor, equipe, operadora e período | `/vendas`, `sales-page-scope.ts` e catálogo de métricas existem. Falta amarrar produto/operadora, equipe histórica e os três marcos com drill coerente. |
| LP-03 | Acompanhamento de propostas efetivamente implantadas | Venda tem apólice, início de cobertura e evidência; `active_customers` guarda carteira. Falta fila própria, estados e conferência explícita da implantação. |
| LP-04 | Confirmação condicionada ao pagamento de parcelas posteriores à primeira | Não confundir com `commission_schedule.status = paid`, que não representa comprovação da mensalidade do cliente. Criar fatos distintos; regra de elegibilidade pendente. |
| LP-05 | Funil entre produção, implantação e confirmação | Existem funis comerciais. Falta funil de pós-fechamento com datas, coortes, perdas e rastreabilidade dos três fatos. |
| LP-06 | Visibilidade conforme hierarquia comercial | Quatro papéis reais no código: broker, supervisor, manager, director. Cargos personalizados restringem o papel. Preservar unidade/equipe e documentar divergências de documentos antigos que citam só três papéis. |
| LP-07 | Competição interna com fases, pódio, categorias e apuração | Jornada tem campanhas por métricas operacionais. Campanha Meta é aquisição, não incentivo. Faltam apuração financeira versionada, desempate, contestação e premiação por fase. |
| LP-08 | Perguntas em linguagem natural com gráficos | `/assistente` existe. Não foi demonstrado atendimento a todas as métricas financeiras; falta contrato de ferramentas analíticas somente leitura, explicação e escopo. |
| LP-09 | Exibição de indicadores em TV | Não localizada rota de TV. Criar apresentação derivada de agregados permitidos, expiração, revogação e proteção de dados pessoais. |
| LP-10 | Comparação e aprofundamento por operadora | Cadastro e vínculos de plano existem. Falta perspectiva canônica por operadora, metas e comparação produzido/implantado/recebido. |
| LP-11 | Evolução mensal e comparação anual | Existem tendências e janelas de métricas. Falta visão YoY com meses incompletos, base zero, competência e definição do fato comparado. |
| LP-12 | Produção diária em relação à meta | Metas e serviços de desempenho existem. Falta perspectiva diária unificada com calendário, atribuição e horário de atualização. |
| LP-13 | Consulta de comissões e recibos com histórico | `commission_rules`, `commission_schedule`, ações e exportação existem. Páginas `/financeiro` não foram localizadas na base; recibo versionado e fechamento completo não foram demonstrados. |
| LP-14 | Registro de vales/adiantamentos | Não localizado livro de adiantamentos. Criar pedido, aprovação, concessão e compensação separados, com saldo e vínculo com repasse. |
| LP-15 | Rede de indicações e conversão | Origem de lead e referral de anúncio não equivalem a uma rede comercial de indicações. Faltam entidade de indicação, atribuição, acompanhamento e deduplicação próprios. |
| LP-16 | Metas mensais editáveis com progresso | `goals`, ações Lite e serviços de métricas já existem. Completar metas de implantação/recebimento só após definir os indicadores correspondentes. |
| LP-17 | Proteção de dados por usuário e nível | Base multi-tenant e cargo restritivo existem. Toda nova leitura, exportação, ferramenta IA e apresentação deve reaplicar os limites no servidor. |

## O que a expansão acrescenta além da LP

A LP é de BI para corretora, não uma especificação de ERP completo. Os módulos seguintes são propostas para fechar a operação da Âncora: contas a receber da corretora, contas a pagar, caixa e conciliação, fornecedores/despesas, fechamento e repasses, cadastro de parceiros, importação com conferência e administração dos módulos. Não atribuir essas funcionalidades ao fornecedor.

O produto terá cinco grupos, exibidos progressivamente conforme papel e prontidão:

- Comercial: leads, clientes, propostas, vendas e indicações.
- Operação: implantação, carteira, pendências e pós-venda.
- Financeiro: recebíveis, despesas, comissões, adiantamentos, repasses e fechamento.
- Pessoas e performance: estrutura da equipe, metas e incentivos.
- Inteligência e administração: relatórios, assistente, TV, importações, acesso e auditoria.

## Documentos de execução

- [Cargos, ações, escopos e rotas](./acessos-e-rotas.md).
- [Plano por funcionalidade e sequência de entrega](./plano-de-implementacao.md).
- [Registro da fundação](../../implementations/active/2026-11-12-erp-operacional-foundation.md).

Não há promessa de lançamento dos módulos por este plano. Rotas reservadas não são páginas implementadas; nenhum acesso foi concedido a membros em produção. As decisões DEC-004 e DEC-012 continuam pendentes nos pontos ainda não resolvidos.
