# Plano de implementação por funcionalidade

Data: 2026-11-12. Escopo operacional aprovado na sessão. Regras financeiras definitivas, alçadas e política multiunidade permanecem pendentes. Este documento especifica trabalho futuro; não declara módulos entregues.

## Ordem e critério de entrega

| Marco | Resultado utilizável | Dependências | Gate de aceite |
|---|---|---|---|
| M0 | Cadastros consistentes, importação conferida e governança de módulos | Fundação de reservas; decisões de acesso | Um lote sintético entra uma vez, pode ser rejeitado e deixa trilha; nenhum cargo ganha acesso por acidente |
| M1 | Venda acompanhada até a implantação | M0 e fonte da confirmação da operadora | Operações resolve uma proposta pendente; corretor acompanha apenas o que pode ver |
| M2 | Mensalidades conhecidas, recebíveis da corretora e conciliação separados | M1; fonte documental e regras mínimas aprovadas | Baixa parcial, duplicata, divergência e reversão demonstradas sem confundir comissão com prêmio/mensalidade |
| M3 | Meu financeiro, comissão, repasse e recibo | M2; DEC-004 resolvida no escopo da entrega | Corretor consegue explicar cada centavo do repasse a partir dos fatos de origem |
| M4 | Despesas, adiantamentos, caixa e fechamento | M3; alçadas, segregação e saldo inicial aprovados | Fechamento reconcilia saldos; ajuste posterior preserva o histórico |
| M5 | Metas e campanhas de incentivo | Métricas e fatos dos marcos anteriores | Apuração reproduzível, empate e contestação tratados sem premiar previsão como caixa |
| M6 | Rede de indicações | Cadastros e atribuição aprovados | Uma indicação pode virar venda sem gerar lead duplicado ou perder o indicador original |
| M7 | BI de produção, operadoras, evolução e diário | Catálogo de métricas, M1 a M4 conforme indicador | Todo agregado abre os registros que explicam o total autorizado |
| M8 | Assistente analítico e TV | M7, audiência e política de exposição | IA e TV não revelam dados que a tela operacional negaria |

Não fixar prazos antes de conferir capacidade da equipe, qualidade dos dados históricos e decisões pendentes. Cada marco deve virar lotes pequenos: contrato e migração aditiva, serviço/guard, interface compartilhada, importação/reconciliação, QA e piloto. Cotador interno permanece fora desta sequência.

## 1. Fundação, governança e cadastros

**Reutilizar:** tenants, unidades, membros, clientes, operadoras, planos, papéis, cargos e system settings. Não criar cadastros duplicados. Complementar parceiros, fornecedores, centros de custo e identificadores externos quando o domínio exigir.

**Dados:** responsável, unidade, status ativo/inativo, identificadores da origem e vigência; alterações de estrutura precisam preservar a atribuição histórica de um negócio. Definir dicionário dos campos, obrigatoriedade por etapa e qualidade esperada, sem exigir dados pessoais sem finalidade.

**Ações:** consultar, cadastrar, corrigir duplicidade com revisão, inativar, revisar acesso, configurar módulo e limite. Evitar exclusão de entidade referenciada por fatos financeiros. Perfis e limites na matriz de acessos, não por strings na interface.

**Controle:** disponibilidade global e por tenant, dependências, parâmetros versionados e motivo de bloqueio. Super-admin pode desligar e reativar; Diretor administra o permitido no tenant. Alterações registram ator, escopo, antes/depois mínimo, motivo e resultado. Sem efeito de “flag desligada libera acesso legado”.

**Aceite:** tenant A não referencia operadora/plano/cliente do tenant B; unidade ausente nega operação; mudança de gestor não reescreve automaticamente o histórico; módulo desligado bloqueia leitura, mutação e exportação conforme política sem apagar fatos.

## 2. Importação e manutenção sem dependência de API externa

**Rotas:** `/administracao/importacoes`, com tipo de arquivo e domínio como contexto. Arquivos autorizados CSV/XLSX e lançamentos manuais são suficientes para o primeiro marco. Nenhum scraper ou monitoramento externo de produção é criado nesta entrega.

**Campos:** origem, arquivo privado, hash, competência, versão do layout, tipo de evento, referência da proposta/contrato/parcela, data do fato, moeda e valores. Evidência só fica disponível ao perfil autorizado.

**Fluxo:** recebido → validado → prévia → aprovado → aplicado; alternativas rejeitado, erro e cancelado antes da aplicação. Conferir vínculos, duplicatas, totais, tipos, vigências e linhas sem correspondência. Não criar cliente ou pagar comissão automaticamente por célula não reconhecida.

**Automação interna:** jobs idempotentes para validar, reconciliar e recalcular projeções depois da aprovação. Chave por tenant/origem/identificador e versão; reprocessamento não duplica lançamento. Retries limitados, fila de falha, observabilidade, responsável e execução manual autorizada.

**Rotina da equipe:** Operações confere implantações diariamente; Financeiro confere extratos conforme disponibilidade e resolve divergências; liderança revisa exceções; fechamento compara lote e saldo. A tela deve mostrar última atualização, origem e quem revisou, sem prometer tempo real de uma fonte manual.

**Aceite:** mesmo arquivo duas vezes não duplica fatos; arquivo malformado ou outra empresa é rejeitado; aplicação parcial exige política explícita e reconciliação; prévia nunca muda saldo; exclusão do arquivo não apaga trilha legalmente necessária, conforme retenção a definir.

## 3. Produção comercial e funil pós-fechamento

**LP:** LP-02, LP-05. **Rotas:** reutilizar `/vendas`, ficha e relatórios; nova perspectiva `/relatorios/producao` só quando pronta.

**Campos:** cliente/lead, proposta, corretor, equipe/unidade na data do fato, operadora/plano, produto, vidas quando pertinente, data da venda, valor comercial com significado explícito, início de vigência e evidência. Não tratar valor de mensalidade como receita líquida da corretora.

**Ações:** registrar/corrigir venda com validação; encaminhar para implantação; consultar marcos e pendências; cancelar com motivo e consequência prevista. Corretor atua na própria carteira; gestão só no universo autorizado.

**Regras:** fechamento não comprova implantação; implantação não comprova recebimento. Funil por coorte de venda é diferente de eventos ocorridos no mês. Exibir método, período, unidade de medida e cancelamentos. Evitar join de uma venda a muitas parcelas inflar o número de vendas.

**Automação e aceite:** criação idempotente da pendência de implantação após venda elegível. Uma venda com três parcelas continua sendo uma venda; filtros de equipe não incluem colegas externos; ajuste retroativo deixa trilha e não troca silenciosamente a definição de uma métrica.

## 4. Implantação e carteira

**LP:** LP-03. **Rotas:** `/implantacoes`, ficha; reutilizar cliente e `active_customers`.

**Campos:** negócio, protocolo/proposta, operadora, responsável pela conferência, documentos privados, pendência categorizada, prazo, apólice/contrato, data de aprovação e início de cobertura. Somente dados necessários para comprovar o marco.

**Estados propostos:** aguardando documentos → conferência → enviado à operadora → pendência da operadora → implantado; alternativas recusado/cancelado. Transições e evidências obrigatórias precisam de validação operacional antes do motor.

**Ações:** atribuir, solicitar complemento, registrar envio, conferir resposta, comprovar implantação ou recusa, reabrir com motivo. Corretor fornece complemento; Operações confere; Diretor trata exceção. Não implantar por existência isolada de texto da IA.

**Automação:** prazos e tarefas internas; criação/vinculação da carteira após fato válido, sem duplicata. Renovação existente permanece uma responsabilidade do pós-venda.

**Aceite:** implantação exige evidência e data coerente; protocolo repetido tem tratamento definido; cancelamento conserva cronologia; a tela diferencia “a confirmar” de fato conferido. Valor/estado ausente não vira zero/ativo por default.

## 5. Mensalidades, confirmações e recebíveis da corretora

**LP:** LP-04; recebível da corretora é extensão ERP. **Rotas:** `/confirmacoes`, `/financeiro/recebiveis`, `/financeiro/conciliacao`.

**Separar os fatos:** (a) mensalidade devida e paga pelo cliente à operadora; (b) comissão/receita devida e recebida pela corretora; (c) comissão devida e repassada ao corretor. Cada fato tem pagador, recebedor, moeda, valor, vencimento, data efetiva, origem e evidência. Um não comprova o outro.

**Campos:** contrato, referência/competência, número da parcela, valor esperado, recebimentos parciais, divergência, fonte, lançamento conciliado e responsável. Indicar “não informado” quando não há fonte do pagamento do cliente. Não afirmar inadimplência por falta de dado importado.

**Estados:** em aberto, parcial, liquidado, vencido segundo calendário aprovado, contestado, cancelado; reversões são eventos compensatórios, não remoção da baixa. Nunca inferir recebimento apenas porque o prazo passou.

**Ações:** importar ou registrar evidência, vincular, conferir, confirmar conciliação, contestar e reverter com motivo. Separar quem registra de quem aprova quando a alçada exigir.

**Decisões:** regra da segunda parcela, coorte e valor da “confirmação” da LP continuam pendentes; não expor esse indicador como confirmado até a decisão. Regras de vencimento, parcialidade e fontes oficiais também precisam de aceite por domínio.

**Aceite:** mensalidade paga não marca repasse do corretor como pago; comissão recebida parcial não liquida todo o título; evento duplicado não soma duas vezes; estorno mantém a ligação ao evento original.

## 6. Comissões e Meu financeiro

**LP:** LP-13. **Rotas:** `/financeiro`, `/financeiro/comissoes`; reutilizar `/configuracoes/comissoes` e ficha de venda.

**Reutilizar:** regras e cronograma existentes. Antes de ampliar, resolver DEC-004 para a operação entregue: moeda, base, percentual, arredondamento, vigência, prioridade entre regras, beneficiários e cancelamento. Uma regra nova não recalcula histórico pago sem revisão explícita.

**Campos:** beneficiário, venda, regra/versão, base, percentual, valor previsto, valor elegível, valor aprovado, competência, vencimento e eventos de pagamento/estorno. “Previsto”, “recebido pela Âncora” e “pago ao corretor” são colunas distintas.

**Ações:** simular aplicação, conferir falta de regra, revisar cronograma, preparar repasse e solicitar revisão. Corretor consulta e pede conferência; funções financeiras operam por delegação; Supervisor não recebe remuneração dos colegas por padrão.

**Automação:** gerar projeção determinística e idempotente quando houver regra válida; suspender caso sem regra ou evidência, sem inventar percentual. Recalcular só projeção autorizada e manter versão.

**Aceite:** centavos fecham conforme política aprovada; duas regras conflitantes geram pendência; alteração de regra preserva pagamentos antigos; extrato próprio não contém totais de colegas; consultas antigas devem ser revisadas para cargo, Supervisor e Gestor sem unidade antes de reutilização.

## 7. Repasses e recibos

**LP:** LP-13. **Rotas:** `/financeiro/repasses`, `/financeiro/recibos`.

**Dados/estados:** lote por competência, beneficiários, parcelas elegíveis, descontos identificados, adiantamentos compensados, valor líquido e aprovação. Rascunho → conferido → aprovado → liquidado; alternativas rejeitado/cancelado antes de liquidar e ajuste compensatório depois.

**Ações:** preparar, revisar, aprovar, registrar liquidação com evidência, emitir recibo, consultar e contestar. Alterar favorecido/valor invalida aprovação e exige nova conferência. Registro de liquidação não é iniciação de transferência bancária.

**Recibo:** snapshot versionado do lote e seus itens, emissão, emissor e referência; acesso autenticado e auditado; documento privado. Não chamar de comprovante bancário ou nota fiscal. Cancelamento mantém via e motivo.

**Aceite:** duas execuções não pagam duas vezes; lote liquidado não pode ser editado; recibo bate com itens e compensações; Corretor só baixa o próprio; falta de comprovante não aparece como pagamento bancário verificado.

## 8. Adiantamentos e vales

**LP:** LP-14. **Rota:** `/financeiro/adiantamentos`.

**Campos:** solicitante, beneficiário, motivo, valor pedido/aprovado/concedido, unidade, competência, evidência, parcelas de compensação, saldo e limite da política vigente.

**Fluxo:** solicitado → em análise → aprovado/recusado → concedido → parcialmente compensado → encerrado. Aprovação não altera caixa; concessão comprovada altera; compensação vincula o repasse e não duplica despesa.

**Ações:** pedir, conferir saldo e limite, aprovar por alçada, registrar concessão, agendar compensação e estornar justificadamente. Definir limites, desconto máximo e saída do colaborador antes do motor definitivo.

**Automação/aceite:** projeção de saldo e alerta de limite após fatos aprovados; pedido repetido não concede duas vezes; saldo não desaparece quando o membro é inativado; repasse sem saldo suficiente segue política aprovada, sem valor líquido negativo inventado.

## 9. Despesas, caixa e fechamento

**Extensão ERP. Rotas:** `/financeiro/despesas`, `/financeiro/fluxo-caixa`, `/financeiro/fechamentos`.

**Campos:** fornecedor/beneficiário, categoria, centro de custo, unidade, competência, vencimento, moeda, valor, conta, recorrência autorizada, documentos e aprovação. Saldo inicial tem data, origem e conferência.

**Fluxo:** despesa rascunho → submetida → aprovada → parcialmente/totalmente paga; recusa e ajuste. Fluxo de caixa separa realizado e previsto; DRE gerencial futura separa competência de caixa e não substitui contabilidade fiscal.

**Fechamento:** conciliar entradas/saídas, resolver exceções, aprovar competência e congelar snapshot; reabertura com motivo e alçada. Desativar módulo preserva histórico e não permite editar fechamento por outra rota.

**Automação:** lembretes, previsão de recorrência em rascunho, detecção de duplicata e fila de divergências. Sem execução bancária ou conta externa automática neste escopo.

**Aceite:** saldo final = saldo inicial + entradas realizadas − saídas realizadas; transferência entre contas não duplica receita/despesa; adiantamento e repasse não contam duas vezes; alteração após fechamento gera ajuste rastreável.

## 10. Hierarquia e metas

**LP:** LP-06, LP-16. **Rotas:** equipe/unidade existentes; `/metas` como extensão dos serviços atuais.

**Dados:** vínculo vigente e histórico, responsável, escopo, indicador canônico, alvo, unidade de medida, período, calendário e versão. Não transformar o campo textual de cargo em autoridade.

**Ações:** definir meta mensal, distribuir por equipe/corretor, acompanhar, revisar com vigência e consultar memória de cálculo. Supervisor vê sua equipe operacional; gestor respeita política de unidade; Diretor consolida. Não alterar a allowlist atual do Gestor neste lote.

**Regras/automação:** progresso só de métricas aprovadas; diário depende de dias úteis/escala definidos, sem dividir por 30 automaticamente. Transferência de corretor exige decidir atribuição dos fatos antes/depois, preservando histórico. Atualizar projeções após eventos válidos.

**Aceite:** membro sem equipe não ganha dados globais; meta de moeda não mistura contagem; meta vencida não é sobrescrita; equipes sem meta exibem ausência; cache contém tenant, usuário e escopo.

## 11. Incentivos e premiações

**LP:** LP-07. **Rota:** `/campanhas-incentivo`, sem misturar com `/marketing/campanhas` ou pontos da Jornada.

**Campos:** regulamento/versão, vigência e fuso, público, métrica, categorias por operadora/produto, fases, critérios de elegibilidade, desempate, premiação, teto e contestação. Definir essas decisões com a liderança antes da apuração monetária.

**Fluxo:** rascunho → aprovado → vigente → apuração preliminar → contestação → encerrado. Mudança de regulamento em campanha vigente precisa de política explícita; não alterar o resultado retroativamente em silêncio.

**Automação:** apurar somente fatos elegíveis, produzir snapshot e explicar cada posição; premiação aprovada pode gerar obrigação financeira identificada, não pagamento automático. Campanha suspensa não apaga pontuação/histórico.

**Aceite:** empate determinístico; cancelamento/estorno segue a versão do regulamento; perfil sem acesso financeiro vê apenas ranking permitido; recálculo com os mesmos fatos e versão reproduz o resultado.

## 12. Indicações

**LP:** LP-15. **Rota:** `/indicacoes` e ficha, vinculando cadastro e lead existentes.

**Campos:** indicador, canal/origem, indicado com dados mínimos, responsável, consentimento/base de contato conforme política, data, negócio vinculado e motivo de perda. Não confundir indicação comercial com referral técnico de anúncio.

**Fluxo:** registrada → validada → em contato → oportunidade → convertida/perdida; duplicada vincula ao negócio existente conforme regra aprovada. Titularidade e janela de atribuição precisam de decisão; não construir rede multinível ou bonificação por suposição.

**Ações:** registrar, buscar duplicidade, encaminhar, acompanhar conversão e revisar atribuição. Indicador vê o andamento autorizado, sem dados sensíveis do indicado ou comissão alheia.

**Automação/aceite:** deduplicação escopada e tarefa de atendimento idempotente; duas indicações do mesmo contato não geram duas vendas; origem original permanece rastreável; contestação não reassocia automaticamente titularidade.

## 13. BI, operadoras, crescimento e análise diária

**LP:** LP-01, LP-02, LP-05, LP-10, LP-11, LP-12. **Rotas:** novas perspectivas sob `/relatorios`, reutilizando drill e exportação existente.

**Contrato por indicador:** ID/versão, nome, fato, unidade, numerador/denominador, janela/coorte, calendário/fuso, moeda, regra de cancelamento, dimensões, escopo, frescor e destino do drill. Operadora requer dimensão validada; não recalcular fórmulas no frontend.

**Visões:** produção/implantação/recebimento separados; operadoras com participação e conversão; evolução mensal e YoY; diário com inserção versus data do fato; ranking com escopo. YoY sem histórico é indisponível, base zero não resulta em infinito e mês parcial é identificado.

**Atualização:** evento aprovado invalida a projeção/cache do escopo; jobs com watermark e idempotência reparam falhas. Mostrar data da fonte e da atualização. “Tempo real” descreve propagação interna, não recebimento instantâneo de arquivo externo.

**Aceite:** agregado e drill reconciliam; filtros só estreitam o escopo; venda com muitas parcelas não infla produção; exportação registra filtros, quantidade e motivo quando necessário; Supervisor continua sem valores de colegas.

## 14. Assistente analítico

**LP:** LP-08. **Rota:** evoluir `/assistente`, sem criar novo provedor ou integração neste lote.

**Ferramentas:** consultar somente métricas registradas com parâmetros validados; resolvedor impõe sessão/tenant/escopo. Não executar SQL fornecido pelo modelo, não aceitar papel/unidade do texto como autorização e não realizar pagamentos ou concessões via pergunta.

**Resposta:** valor, período, unidade, atualização, descrição da métrica, gráfico acessível quando fizer sentido e link para drill autorizado. Ambiguidade de “confirmado” exige escolha do fato. Sem dado, informar ausência.

**Auditoria/aceite:** registrar ferramenta e escopo, com minimização de texto pessoal; manter custo/limites e chave de disponibilidade pelo Super-admin. Solicitação de dados de outra equipe, injeção em arquivo ou prompt de administrador não amplia o acesso; gráfico usa o mesmo conjunto validado da resposta.

## 15. Modo TV

**LP:** LP-09. **Rota:** `/tv`.

**Dados/configuração:** playlist de métricas aprovadas, audiência, unidade/equipe, período, intervalo, tempo de sessão e campos permitidos. Remuneração individual, contatos e documentos ficam fora por padrão. Ranking nominal exige política de exposição aprovada.

**Ações:** escolher playlist, pré-visualizar, iniciar, pausar e encerrar. Preferir sessão autenticada com privilégio mínimo; token de apresentação, se necessário, exige desenho específico, expiração curta e revogação, sem link público permanente.

**Aceite:** desligamento revoga apresentação; sessão expirada não continua revelando cache; falha mostra data da última atualização; apresentação reduz animações, preserva contraste e não exige interação constante. Nunca exporta dados detalhados para montar slides no cliente.

## Padrão de experiência e qualidade

Preservar shell, tokens Arc/Lite e componentes compartilhados de `ui`/`unlumen-ui`. Não copiar a identidade visual da LP nem lançar outro design system. Lista operacional primeiro: contexto, uma ação principal, filtros recuperáveis, tabela e detalhe em sheet quando apropriado. Campos raros por disclosure; termos do domínio iguais entre áreas.

Toda tela cobre carregamento, vazio, erro, sucesso, acesso negado, módulo desligado, atualização atrasada e pendência de conferência. Dados não informados não viram zero. Teclado, foco, leitor de tela, zoom e mobile são critérios de aceite. Novas transições usam `transitions-dev`, movimento discreto e `prefers-reduced-motion`; números financeiros só aparecem como confirmados após resposta do servidor.

Cada módulo deve ter parâmetros editáveis, flag global/tenant administrável pelo Super-admin, dependências explícitas, auditoria de ativação e desligamento e trilha das operações. Nenhum módulo é declarado pronto sem essa governança.

## Decisões ainda necessárias, no momento da respectiva entrega

| Decisão | Impede | Recomendação a validar |
|---|---|---|
| Significado e condição da confirmação comercial, inclusive segunda parcela | Indicador de confirmação e premiação baseada nele | Fatos separados; escolher métrica com Financeiro/Operações |
| DEC-004: moeda/base/vigência/arredondamento/estorno | Motor definitivo e recálculo | Regra versionada, pagamentos históricos preservados |
| DEC-012: multiunidade e transferência | Consolidado de Gestor e atribuição histórica | Fail closed e concessão explícita |
| Fonte documental de cada fato e rotina de importação | Liquidação confiável | Arquivo/documento aprovado, com origem e responsável |
| Alçadas, autoaprovação e acúmulo de funções | Aprovar/conceder/pagar | Separar preparo, aprovação e liquidação; definir exceções |
| Atribuição e bonificação de indicação | Conversão remunerada da rede | Sem rede multinível ou recompensa presumida |
| Calendário, desempate, contestação e premiação | Incentivos e meta diária | Publicar regulamento antes da campanha |
| Retenção e exposição em TV/IA/exportação | Divulgação e documentos financeiros | Minimização e público explícito |

## Piloto, manutenção e rollout

1. Ambiente isolado com dados sintéticos de dois tenants, duas unidades, duas equipes e perfis restritos.
2. Testar autorização de página, ação, exportação, job, IA e arquivo; incluir tentativa de ID externo, unidade ausente, cargo inativo e flag desligada.
3. Importar período histórico controlado, reconciliar quantidade/valor com a fonte e registrar diferenças antes de ativar saldo.
4. Piloto por módulo e tenant, com operadores identificados; não conceder cargo a pessoa automaticamente.
5. Medir exceções sem dono, divergência, atraso da fonte e falhas de job; definir responsável operacional e técnico por módulo.
6. Reversão: desligar a capacidade, impedir novas mutações, preservar fatos/recibos/trilhas e corrigir por evento compensatório. Migração destrutiva não faz parte da fundação.

Ritmo sugerido: Operações acompanha a fila diariamente; Financeiro revisa fontes e divergências diariamente conforme agenda de extratos, confere repasses no ciclo aprovado e fecha competência mensal; Diretoria revisa alçadas, metas e exceções; administrador revisa acessos na admissão, mudança de função e desligamento. Automação reduz digitação e identifica diferença; pessoas aprovam fatos que alteram dinheiro.
