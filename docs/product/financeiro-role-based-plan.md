# Plano do módulo Financeiro por papel

**Status:** planejado — aguardando decisões de negócio para a regra financeira definitiva  
**Escopo:** Corretor, Gestor, Diretor e governança do Super-admin  
**Objetivo:** transformar `/financeiro` em uma experiência orientada ao trabalho de cada papel, com dados escopados no servidor, configurações editáveis, auditoria completa e controle reversível pelo Super-admin.

## 1. Princípios do produto

- **Corretor:** entender quanto vendeu, quanto tem a receber e qual repasse exige atenção.
- **Gestor:** acompanhar a saúde financeira da própria unidade e resolver exceções da equipe.
- **Diretor:** acompanhar a corretora inteira, fechar repasses e configurar as regras financeiras.
- **Super-admin:** controlar disponibilidade, parâmetros e governança da capacidade sem apagar dados.
- Nenhum papel recebe informação fora do escopo autorizado pelo contexto de sessão.
- Métricas, contadores e status vêm de consultas reais; não haverá números fixos de interface.
- Toda ação sensível deve ter consequência clara, confirmação contextual, feedback e auditoria.

## 2. Decisões bloqueantes antes das regras definitivas

As seguintes decisões já estão registradas no `docs/decision-log.md` e precisam ser aprovadas antes de consolidar o motor financeiro:

1. **DEC-004 — Comissão:** moeda, base de cálculo, percentual, vigência, arredondamento, estorno, cancelamento e comportamento de parcelas já pagas.
2. **DEC-012 — Filiais:** gestores com múltiplas filiais, escopo consolidado, transferência de usuário e fallback de visibilidade.

Enquanto essas decisões não forem aprovadas, é permitido evoluir a composição visual, os filtros e as consultas baseadas no modelo atual, mas não criar novas regras financeiras irreversíveis por suposição.

## 3. Matriz de escopo e ações

| Capacidade | Corretor | Gestor | Diretor | Super-admin |
|---|---:|---:|---:|---:|
| Ver próprias vendas e comissões | Sim | Sim | Sim | Conforme suporte operacional |
| Ver dados da unidade | Não | Sim | Sim | Conforme suporte operacional |
| Ver todas as filiais | Não | Conforme DEC-012 | Sim | Sim |
| Configurar regras de comissão | Não | Não | Sim | Controla disponibilidade, não substitui o Diretor |
| Marcar parcela como paga | Não | Conforme decisão aprovada | Sim | Não executa pagamento do tenant |
| Reverter pagamento | Não | Não | Sim, com motivo | Não executa operação financeira do tenant |
| Exportar dados | Apenas se aprovado para o próprio escopo | Unidade | Corretora | Plataforma/auditoria |
| Ver auditoria financeira | Não | Escopo da unidade, se aprovado | Sim | Sim |
| Ativar/desativar módulo e políticas | Não | Não | Não | Sim |
| Editar parâmetros governáveis | Não | Não | Parâmetros do tenant autorizados | Limites e disponibilidade global |

## 4. Experiência do Corretor

### Objetivo

Responder rapidamente: “quanto eu vendi, quanto vou receber e o que está pendente?”.

### Conteúdo

- Cabeçalho **Meu financeiro**, período e escopo pessoal.
- KPIs: vendas, valor vendido, comissão prevista, comissão paga, comissão pendente e próximo repasse.
- Bloco **O que precisa da sua atenção** com repasse pendente, atraso, venda sem regra ou venda cancelada.
- Lista **Minhas vendas** com cliente/lead, data, produto, valor, comissão, próximo repasse e status.
- Lista **Meus repasses** com parcela, referência, percentual, valor, vencimento e pagamento.
- Link para o detalhe da venda, sem expor outras pessoas da unidade.

### Ações

- Ver venda.
- Ver cronograma.
- Solicitar revisão ao gestor, quando essa ação for aprovada.

O Corretor não poderá editar regra, marcar pagamento, reverter parcela ou visualizar totais de colegas.

## 5. Experiência do Gestor

### Objetivo

Responder: “como está a unidade e qual pendência financeira precisa ser tratada agora?”.

### Conteúdo

- KPIs da unidade: vendas, receita, comissões previstas, pagas, pendentes e atrasadas.
- Comparativo por corretor com vendas, valores, comissões e pendências.
- Filas acionáveis:
  - repasses vencidos;
  - vendas sem regra;
  - vendas sem cronograma;
  - parcelas aguardando conferência;
  - cancelamentos pendentes;
  - corretores sem venda no período.
- Drawer de detalhe do corretor com resumo, vendas, repasses e histórico permitido.
- Fechamento mensal da unidade, com conferência e exportação dentro do escopo.

### Ações

- Filtrar por período, corretor, status e produto.
- Abrir a venda ou parcela que originou o indicador.
- Registrar revisão ou encaminhamento.
- Marcar pagamento somente se a regra aprovada permitir ao Gestor.

## 6. Experiência do Diretor

### Objetivo

Responder: “qual é a saúde financeira da corretora e quais decisões exigem minha intervenção?”.

### Conteúdo

- Resumo executivo da corretora.
- Receita, comissão prevista, paga, pendente, atrasada e cancelada.
- Evolução mensal com drill-down para vendas e parcelas.
- Comparativo entre filiais.
- Comparativo entre corretores.
- Central de fechamento e repasses.
- Alertas de vendas sem regra, cronogramas incompletos e divergências.
- Acesso às regras de comissão e seu impacto nas vendas existentes.

### Ações

- Marcar parcela como paga.
- Reverter pagamento com motivo obrigatório.
- Cancelar parcela conforme regra aprovada.
- Exportar relatório auditado.
- Revisar regra aplicada à venda.
- Configurar regras de comissão dentro dos parâmetros permitidos.

## 7. Governança obrigatória

### Editabilidade

Os parâmetros financeiros editáveis deverão possuir uma superfície administrativa própria, com:

- formulário validado no servidor;
- histórico de versões;
- vigência e responsável pela alteração;
- preview do impacto quando possível;
- confirmação para alterações com efeito financeiro;
- opção de desativar sem apagar histórico.

### Auditoria

Registrar, no mínimo:

- ator, papel, tenant e filial;
- data e hora;
- ação e entidade afetada;
- valor anterior e novo valor quando aplicável;
- filtros e quantidade em exportações;
- motivo de cancelamento ou reversão;
- sucesso ou falha;
- correlação com a venda, parcela ou regra.

O log não deve incluir dados pessoais desnecessários nem conteúdo sensível em claro.

### Controle pelo Super-admin

O Super-admin deverá conseguir:

- ativar ou desativar o módulo Financeiro;
- ativar ou desativar exportações;
- ativar ou desativar pagamento manual;
- definir quais papéis podem conferir ou marcar parcelas;
- controlar limites configuráveis e feature flags por tenant;
- consultar auditoria de alterações e mudanças de disponibilidade;
- reativar a capacidade sem alteração manual de código ou banco.

Quando uma capacidade estiver inativa, a interface deve informar o motivo e a alternativa disponível, sem apresentar um botão que não terá consequência.

## 8. Arquitetura proposta

### Consultas por escopo

Evoluir `src/features/financeiro/queries.ts` para contratos explícitos:

- `getBrokerFinancialSummary`;
- `getManagerFinancialSummary`;
- `getDirectorFinancialSummary`;
- `getCommissionSchedule`;
- `getFinancialAlerts`;
- `getFinancialBreakdown`.

Cada consulta deve receber o contexto confiável do servidor e aplicar tenant, filial, equipe e corretor antes de qualquer filtro visual.

### Componentes compartilhados

Evoluir componentes reutilizáveis para:

- grade de KPIs;
- filtro de período e escopo;
- tabela de repasses;
- status financeiro;
- filas de pendências;
- tabela de vendas;
- detalhe de corretor/filial;
- estados vazio, erro, permissão e indisponibilidade.

Variações por papel devem ser composição/configuração do mesmo sistema, não cópias locais de dashboard.

### Rotas previstas

```text
/financeiro
/financeiro/vendas
/financeiro/repasses
/financeiro/corretores
/financeiro/filiais
/financeiro/alertas
/financeiro/auditoria
/configuracoes/comissoes
```

Rotas e ações serão exibidas somente quando a permissão e a prontidão do módulo permitirem.

## 9. Fases de implementação

### Fase 0 — contrato e decisões

- Aprovar DEC-004 e DEC-012.
- Definir estados e vocabulário financeiro.
- Definir matriz de permissões.
- Definir parâmetros editáveis e controles do Super-admin.

### Fase 1 — fundação segura

- Separar consultas por papel.
- Centralizar autorização financeira.
- Criar contratos tipados.
- Adicionar testes de isolamento de tenant, filial e corretor.
- Preparar auditoria de leitura sensível, mutações e exportações.

### Fase 2 — Corretor

- Implementar resumo pessoal.
- Implementar vendas próprias.
- Implementar repasses próprios.
- Implementar alertas pessoais.
- Validar que nenhuma métrica de unidade aparece para o Corretor.

### Fase 3 — Gestor

- Implementar resumo da unidade.
- Implementar comparativo por corretor.
- Implementar filas de pendências.
- Implementar revisão/encaminhamento.
- Implementar fechamento no escopo autorizado.

### Fase 4 — Diretor

- Implementar resumo consolidado.
- Implementar filiais e corretores.
- Implementar fechamento e pagamento manual.
- Implementar reversão e cancelamento.
- Integrar regras de comissão ao impacto financeiro.

### Fase 5 — governança

- Criar controles do Super-admin.
- Criar configurações editáveis por tenant.
- Criar histórico de versões.
- Criar auditoria consultável.
- Implementar estados de capacidade ativa/inativa.

### Fase 6 — validação

- Cenários sintéticos para os três papéis.
- Testes de permissão e tenant.
- Testes de cálculo e status.
- Testes de acessibilidade e dark mode.
- Checklist de engenharia.
- Build de produção.
- Atualização do roadmap com arquivos e validações.

## 10. Critérios de aceite

- Cada papel vê somente o escopo autorizado.
- O Corretor consegue identificar vendas, comissão pendente e próximo repasse sem acessar dados da equipe.
- O Gestor consegue localizar e tratar pendências da unidade.
- O Diretor consegue consolidar, conferir e fechar a operação financeira.
- Configurações financeiras podem ser editadas por usuários autorizados.
- Toda alteração financeira e exportação gera auditoria.
- O Super-admin consegue desligar e reativar capacidades sem apagar dados.
- Capacidades desligadas não exibem ações sem efeito.
- Não existem contadores estáticos ou valores fictícios.
- Light, dark, teclado, foco, viewport estreito e estados de erro estão cobertos.
- A lógica crítica possui testes determinísticos e o build de produção passa.
