# Cargos, acessos e rotas do ERP operacional

Estado: matriz proposta, com fundação de reservas; nenhuma associação automática de pessoa a cargo. Escopo aprovado: ERP operacional, sem fiscal/folha/notas.

## Regra de autorização

Permitir somente quando todas as condições forem satisfeitas: módulo implementado e ativo, dependências ativas, sessão válida, capacidade efetiva, rota autorizada e objeto dentro do escopo. Ocultar um menu não protege o servidor. Uma reserva de rota continua bloqueada, inclusive para Diretor e cargo com concessão forjada.

O sistema possui quatro papéis técnicos: `broker`, `supervisor`, `manager`, `director`. Um cargo de função não cria um quinto papel nem autoriza promover alguém a Diretor para contornar uma permissão. O cargo personalizado é uma restrição do teto efetivo do papel/função. O Super-admin governa a plataforma e não se torna aprovador financeiro da corretora.

O Gestor tem hoje a allowlist restrita de `manager-routes.ts`. A matriz futura abaixo não muda essa decisão. Ampliação para ERP precisa de política explícita, capacidade e flag, testes e aprovação de escopo. Supervisor não recebe valores de colegas por herdar acesso operacional.

## Perfis e separação de responsabilidades

| Perfil funcional | Papel atual ou tratamento necessário | Escopo máximo proposto | Trabalho permitido | Limite |
|---|---|---|---|---|
| Corretor | broker | Próprio | Registrar/acompanhar negócios, documentos, metas e indicações; consultar comissão e recibo próprios | Não confirmar recebimento, implantar contrato nem pagar/reverter parcela |
| Supervisor | supervisor | Corretores vinculados à equipe | Pendências, volume, conversão, metas e incentivo operacional | Sem remuneração individual dos colegas; sem dados de outras equipes |
| Gestor de unidade | manager | Unidade autorizada | Acompanhar operação e desempenho da unidade, conforme política de expansão aprovada | Sem fallback de unidade ausente para visão global; acesso financeiro não é automático |
| Diretor | director | Tenant | Definir metas/políticas, aprovar exceções e fechamentos, consultar consolidado | Não acessa outro tenant nem ignora regra de dupla aprovação |
| Operações/implantação | Cargo restritivo; base atual depende da matriz vigente | Unidade(s) explicitamente autorizada(s) | Conferir proposta, registrar implantação, gerir pendências e carteira | Sem caixa, fórmula de comissão ou movimentação financeira |
| Financeiro de conferência | Função finance + cargo, exige capacidades granulares futuras | Unidade(s) ou tenant expressamente concedido | Importar extrato, conferir recebimento, preparar comissão e fechamento | Preparar não é aprovar nem executar; não herdar CRUD comercial desnecessário |
| Aprovador financeiro | Capacidade específica, sem criar promoção ampla | Unidade(s)/tenant concedido | Aprovar lote, adiantamento e exceção dentro da alçada | Impedir autoaprovação conforme política a decidir |
| Executor de repasse | Capacidade específica, separada da aprovação | Lote autorizado | Registrar liquidação e anexar comprovante | Não alterar fórmula, favorecido ou lote aprovado silenciosamente |
| Marketing | Função marketing existente | Campanhas, origens e agregados autorizados | Aquisição e conteúdo; incentivos apenas quando delegado | Sem prontuário, comissão pessoal ou administração financeira |
| Relacionamento/pós-venda | Cargo restritivo a definir | Carteira atribuída | Acompanhar vigência, renovação e solicitações | Sem receber toda a carteira por pertencer à filial |
| Auditoria/qualidade | Leitura granular futura | Escopo expresso | Consultar evidências e trilhas, exportação separada | Sem mutação operacional, sem cargo de corretor usado como atalho |
| Administrador de acessos do tenant | Capacidade específica futura; Diretor hoje administra cargos | Tenant | Preparar e revisar concessões dentro do teto permitido | Não concede a si mesmo poder maior nem opera finanças por ser administrador |
| Super-admin | Plataforma, mecanismo existente | Configuração da plataforma | Ativar/desativar módulo, limites, auditoria de suporte e piloto | Acesso a dados do tenant só por suporte autorizado e auditado |

Os perfis financeiros são responsabilidades que podem ser acumuladas se a política aprovar; não exigem três contratações. O servidor deve registrar quem preparou, aprovou e liquidou. A alçada e a combinação permitida ainda serão decididas.

## Matriz de ações proposta

Legenda: P próprio; E equipe; U unidade; T tenant; D delegado e validado; L leitura; C conferência/preparo; A aprovação; X execução; — sem concessão.

| Área | Corretor | Supervisor | Gestor | Operações | Financeiro | Diretor |
|---|---|---|---|---|---|---|
| Vendas/clientes | P | E operacional | U conforme política | D | Referências mínimas | T |
| Implantação | L/P; envio de pendência | L/E | L/U | C/D | L necessário | T; exceções |
| Mensalidades/recebimentos | L/P permitido, sem comprovante amplo | — financeiro | L/U se aprovado | L do estado necessário | C/D | L/A/T |
| Comissão individual | L/P | L/P | L/U só se aprovado | — | C/D | L/A/T |
| Adiantamento | Solicitar P | Solicitar P | Encaminhar U se aprovado | — | C/D | A conforme alçada |
| Repasse | L/P | L/P | L/U se aprovado | — | C/A/X separados | A; reversão justificada |
| Despesas/caixa | — | — | Solicitar U se aprovado | Solicitar D | C/A/X separados | T/A |
| Metas | L/P | L/E operacional | U conforme política | Indicadores D | Indicadores D | T; configurar |
| Incentivos | Participar P | E | U conforme política | Conferir evidência D | Validar premiação D | Aprovar regulamento |
| BI e IA | P permitido | E sem valores de colegas | U conforme política | D operacional | D financeiro | T |
| Exportação | Negada por padrão; liberação própria separada | Operacional E existente | U autorizado | D separado | D separado | T auditado |
| TV | Conteúdo agregado autorizado | Agregados E aprovados | Agregados U aprovados | — | — por padrão | Configurar audiência |
| Acessos e governança | Própria conta | Própria conta | Limites atuais | — | — | Tenant, dentro das regras |

## Rotas existentes a reutilizar

| Rota existente | Uso no ERP | Condição |
|---|---|---|
| `/vendas` e `/vendas/[id]` | Produção e ficha de negócio | Reutilizar escopo canônico; não substituir venda por caixa |
| `/clientes` e `/clientes/[clientId]` | Cadastro e carteira | Evitar um cadastro paralelo |
| `/propostas` | Proposta comercial | Conferir fluxo real antes de criar nova entrada |
| `/equipe`, `/equipe/minha`, `/unidades/[id]` | Hierarquia e equipe | Preservar allowlists e vínculos atuais |
| `/relatorios` e `/relatorios/drill/[drillId]` | Indicadores e rastreabilidade | Uma definição por métrica; exportação separada |
| `/jornada` | Engajamento operacional atual | Não tratar bônus de pontos como pagamento em dinheiro |
| `/marketing/campanhas` | Campanhas Meta | Não reutilizar como campanha de premiação |
| `/assistente` | Canal de consulta analítica futuro | Ferramentas autorizadas no servidor; sem SQL livre |
| `/configuracoes/comissoes` | Regras atuais de comissão | DEC-004 continua bloqueando novas fórmulas definitivas |
| `/equipe/cargos`, `/settings` | Cargos e configurações existentes | Não duplicar autorização |

## Rotas novas reservadas e públicos planejados

Todas as rotas deste quadro são reservas, sem página operacional nesta entrega. O catálogo de cargos ativos não as oferece. Quando implementadas, cada uma precisará de capacidade específica e configuração governável, além da rota.

| Chave da reserva | Rota | Públicos planejados | Entrega |
|---|---|---|---|
| erp-implantacoes | `/implantacoes` | Operações, Diretor; acompanhamento próprio/equipe/unidade conforme matriz | M1 |
| erp-confirmacoes | `/confirmacoes` | Financeiro de conferência e Diretor | M2 |
| erp-financeiro | `/financeiro` | Meu financeiro para Corretor; Financeiro e Diretor; Gestor só após política | M3 |
| erp-recebiveis | `/financeiro/recebiveis` | Financeiro e Diretor | M2 |
| erp-despesas | `/financeiro/despesas` | Financeiro e Diretor; solicitantes delegados | M4 |
| erp-caixa | `/financeiro/fluxo-caixa` | Financeiro e Diretor | M4 |
| erp-conciliacao | `/financeiro/conciliacao` | Conferente, aprovador e Diretor | M2/M4 |
| erp-comissoes | `/financeiro/comissoes` | Próprio para Corretor; Financeiro e Diretor | M3 |
| erp-repasses | `/financeiro/repasses` | Próprio para Corretor; funções financeiras separadas e Diretor | M3 |
| erp-recibos | `/financeiro/recibos` | Próprio para Corretor; Financeiro e Diretor | M3 |
| erp-adiantamentos | `/financeiro/adiantamentos` | Próprio para solicitante; conferente/aprovador e Diretor | M4 |
| erp-fechamentos | `/financeiro/fechamentos` | Financeiro e Diretor | M4 |
| erp-indicacoes | `/indicacoes` | Corretor; gestão autorizada; Operações delegada | M6 |
| erp-metas | `/metas` | Próprio, equipe/unidade autorizada, Diretor | M5 |
| erp-incentivos | `/campanhas-incentivo` | Participantes; gestão autorizada; premiação validada pelo Financeiro | M5 |
| erp-producao | `/relatorios/producao` | Próprio/equipe/unidade/tenant conforme métrica | M7 |
| erp-operadoras | `/relatorios/operadoras` | Próprio/equipe/unidade/tenant conforme métrica | M7 |
| erp-crescimento | `/relatorios/crescimento` | Gestão autorizada, Financeiro e Diretor | M7 |
| erp-diario | `/relatorios/diario` | Próprio/equipe/unidade/tenant conforme métrica | M7 |
| erp-tv | `/tv` | Apresentação de agregados com sessão/audiência explícita | M8 |
| erp-importacoes | `/administracao/importacoes` | Importador delegado; aprovador por domínio; Diretor | M0 |
| erp-governanca | `/administracao/erp` | Diretor no tenant; controle global no Super-admin existente | M0 |

As fichas futuras usarão o domínio pai e terão autorização do objeto: `/implantacoes/[id]`, `/indicacoes/[id]`, `/campanhas-incentivo/[id]`, `/financeiro/fechamentos/[id]`. Não criar rotas públicas de extrato, recibo ou TV por conveniência. URLs antigas da sidebar financeira precisam de levantamento e redirecionamento apenas quando houver destino real.

## Da proposta à concessão efetiva

1. Resolver a capacidade mínima de cada ação: ler, criar, editar, conferir, aprovar, liquidar, reverter, exportar e administrar são diferentes.
2. Implementar guard no servidor, escopo e auditoria; cobrir ações no manifesto `action-areas.ts`.
3. Integrar a página ao shell autorizado para o papel, inclusive allowlists Lite/Gestor.
4. Ativar módulo por Super-admin e tenant; testar sem dados reais.
5. Criar cargo em rascunho e revisar diff de acessos; associar pessoa somente com autorização identificável e auditoria.
6. Liberar no menu apenas rotas prontas e acessíveis. Desativar módulo não pode remover restrições de cargo nem ampliar o acesso legado.

Não adicionar permissões financeiras à lista geral do Corretor, não promover financeiro para Diretor e não converter a matriz de intenções em autorização de dados.
