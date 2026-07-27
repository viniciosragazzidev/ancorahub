# Catálogo de Regras de Negócio

> **BR-029A — Distribuição automática recuperável e idempotente:** lead em fila gera trabalho persistente; o executor revalida elegibilidade e atribui somente se o lead continua sem owner. Lease vencido ou falha transitória devolve o trabalho à fila com motivo; falha definitiva fica visível e auditável para intervenção humana. Origem: DEC-038.

**Estado:** base de implementação · **Fonte:** `CorreTop_Documento_Requisitos.md` ·
**Convenção:** uma regra deve ter identificador, gatilho, resultado observável e
rastreabilidade. Pendências que impedem uma implementação definitiva ficam no
`decision-log.md`.

## Invariantes transversais

| ID | Regra | Critério verificável | Origem |
|---|---|---|---|
| BR-001 | Todo dado operacional pertence a um tenant; acesso entre tenants é proibido. | Acesso com sessão de outro tenant não retorna nem altera o registro. | RF002 |
| BR-002 | Papéis são Diretor, Gestor e Corretor; permissões não são confiadas ao cliente. | Autorização é decidida no servidor a partir da sessão. | RF004–005 |
| BR-003 | Corretor só acessa seus próprios leads e clientes, inclusive na mesma filial. | Listas, detalhes e ações recusam recursos de outro responsável. | RF005, RF198 |
| BR-004 | Dados sensíveis exigem consentimento, acesso restrito e auditoria. | Evento de consentimento e auditoria são persistidos. | RF080–083 |
| BR-005 | Ações sensíveis precisam ser rastreáveis sem expor o conteúdo sensível no log. | Log inclui ator, data, tipo e alvo; não inclui arquivo/mensagem em claro. | RF081, RF191–192 |

## Conta, tenancy e equipe

| ID | Regra | Gatilho → resultado | Origem |
|---|---|---|---|
| BR-010 | Tenant só é liberado após pagamento confirmado; não existe trial. | Onboarding pago → tenant ativo; inadimplência → acesso bloqueado após tolerância. | RF001, RF006–007, RF090–092 |
| BR-011 | Super-admin gerencia tenant, plano e ativação, fora do escopo das corretoras. | Ação administrativa → altera estado do tenant e gera auditoria. | RF090–091 |
| BR-012 | Diretor pode criar Gestores e Corretores; Gestor pode criar somente Corretores; Corretor não administra equipe. | Tentativa de criar papel acima do escopo → negada no servidor. | RF003–005, prompt 2.3 |
| BR-013 | Usuários operacionais pertencem a uma filial. | Criação/alteração → filial válida no mesmo tenant é obrigatória. | RF100–101 |
| BR-014 | Corretor disponível pode pausar o recebimento; Gestor pode fazê-lo pela equipe. | Pausa → corretor deixa de ser elegível à distribuição. | RF110–112 |
| BR-015 | Cargo organizacional e perfil de acesso são conceitos separados. | Criação/edição → cargo descritivo pode variar sem ampliar permissões; o perfil continua autorizado pelo servidor. | Gestão de equipe |
| BR-016 | Todo membro operacional deve estar vinculado a uma filial ativa. | Criação/edição → unidade selecionada pertence ao tenant e é registrada na associação. | RF100–101 |

## Leads, funil e distribuição

| ID | Regra | Gatilho → resultado | Origem |
|---|---|---|---|
| BR-020 | Lead pode entrar manualmente ou por canal autenticado do tenant. | Entrada válida → lead, origem e evento de timeline são criados. | RF010–012, RF015 |
| BR-021 | O funil tem etapas ordenadas e terminais. | Mudança de etapa → respeita transição permitida e entra na timeline. | RF013 |
| BR-022 | Perda exige motivo. | Transição para `perdido` sem motivo → recusada. | RF014 |
| BR-023 | Novo lead é distribuído por round-robin entre corretores elegíveis da filial. | Lead recebido → próximo elegível recebe atribuição, conforme política do tenant. | RF020–021, RF102 |
| BR-024 | Elegibilidade considera usuário ativo, filial/escopo aplicável, disponibilidade e limite de carga. | Corretor fora de qualquer critério → excluído do round-robin. | RF021, RF110–112 |
| BR-025 | O SLA tem dois relógios: primeiro contato e última interação. | Limite ultrapassado → marca não trabalhado, notifica e/ou redistribui conforme configuração. | RF022–024 |
| BR-026 | Estagnação é diferente de SLA de interação. | Lead permanece na etapa além do limite, ainda que haja interação → alerta de estagnação. | RF194 |
| BR-027 | Reabertura e reatribuição são decisões de Gestor/Diretor e preservam histórico. | Reabertura → lead volta ao fluxo com evento de auditoria/timeline. | RF196 |
| BR-028 | Estouro de SLA remove o corretor responsável antes de redistribuir. | Lead do Diretor tenta outro corretor elegível da unidade e, sem elegível, retorna à fila central da corretora mãe; lead do Gestor retorna à fila da própria unidade para distribuição manual. | DEC-027 |
| BR-029 | Notificação operacional é um evento coordenado. | Capacidade ativa → cria notificação in-app para Realtime/toast e tenta push; capacidade desativada pelo Super-admin → nenhum canal é emitido, com auditoria da alteração. | DEC-028 |

## Cotação, documentos e venda

| ID | Regra | Gatilho → resultado | Origem |
|---|---|---|---|
| BR-030 | O catálogo efetivo combina planos oficiais publicados pelo Super-admin, visíveis por padrão, com extensões privadas do próprio tenant. | Consulta de catálogo → uma ocultação explícita por tenant/unidade prevalece sobre a visibilidade padrão; nenhum item privado vaza para outro tenant. | DEC-031, RF140–142 |
| BR-030A | Preço e condições comerciais são versionados; proposta, PDF e venda preservam a versão usada. | Publicação de tabela nova → novas cotações usam a versão vigente, sem recalcular registros anteriores. | DEC-031 |
| BR-030B | Catálogo oficial e extensão privada possuem administração separada e auditável. | Mudança oficial → somente Super-admin; mudança privada → somente Diretor do tenant, com auditoria. | DEC-031 |
| BR-031 | Atualização manual de tabela é o fallback obrigatório; scraping é complementar. | Falha/desatualização do scraper → alerta e manutenção manual disponível. | RF030–032 |
| BR-032 | Cada cotação é imutável como versão histórica. | Nova cotação → cria novo registro e mantém as anteriores. | RF033–034, RF150–151 |
| BR-033 | Checklist documental depende de operadora/tipo de plano. | Solicitação de documentos → checklist aplicável é materializado e acompanhado. | RF040–041 |
| BR-034 | Documento rejeitado requer observação; avanço para análise só ocorre com checklist aprovado. | Tentativa de avançar incompleta → recusada. | RF042–044 |
| BR-035 | Conversão cria venda e Cliente Ativo ligado a plano e aniversário. | Lead convertido → venda, cliente e eventos subsequentes são criados. | RF130 |

| BR-036 | Todo atendimento pode representar mais de uma pessoa beneficiária e possui exatamente um titular. | Triagem/cotação cria beneficiários persistidos com vínculo ao lead e titular identificado. | Simulação ponta a ponta |
| BR-037 | Requisitos marcados como individuais são exigidos para cada beneficiário; requisitos familiares são exigidos uma vez. | A checklist só considera um requisito individual concluído quando há documento aprovado para cada beneficiário vigente; requisitos familiares exigem uma aprovação. A materialização idempotente por pessoa permanece pendente. | Solução de beneficiários |
| BR-037A | O contato principal do lead é a referência inicial de titular da contratação; seus dados cadastrais devem ser confirmados antes de incluir dependentes. | Detalhe do lead → contato exibido como titular pendente; confirmação da data de nascimento → cria o titular persistido. Dependente com cotação vinculada não pode ser excluído, preservando o histórico. | Atendimento e pós-venda |
| BR-038 | Venda só é registrada com evidência da aprovação da operadora, apólice, início de vigência e valor final aprovado. | Registro incompleto é recusado e apresenta pendências explícitas. | Solução de registro de venda |
| BR-039 | Cancelamento não apaga histórico nem desconta dinheiro automaticamente. | Parcelas futuras são canceladas e parcelas pagas na janela são sinalizadas para decisão manual. | Solução de cancelamento |

## Comissão, pós-venda e metas

| ID | Regra | Gatilho → resultado | Origem |
|---|---|---|---|
| BR-040 | Comissão é definida por operadora/plano como única ou escalonada. | Venda convertida → usa a regra vigente aplicável e gera cronograma. | RF050–051 |
| BR-041 | Comissão prevista, paga e pendente são estados distintos e conferíveis por período. | Marcação de pagamento → atualiza parcela e mantém rastreabilidade. | RF052–054 |
| BR-042 | Renovação gera alerta antecipado; interações pós-venda permanecem no cliente. | Proximidade do aniversário → notificação; interação → histórico do cliente. | RF131–132 |
| BR-043 | Metas podem ser por corretor e por equipe/filial, em período definido. | Registro de venda → recalcula progresso do alvo aplicável. | RF120–121 |

## Comunicação, relatórios e integridade

| ID | Regra | Gatilho → resultado | Origem |
|---|---|---|---|
| BR-050 | Integração oficial de WhatsApp é posterior ao atalho controlado para WhatsApp Web. | MVP → sem histórico integrado; fase posterior → conversa vinculada ao lead. | RF060–063 |
| BR-051 | Eventos relevantes geram notificação in-app; push depende de consentimento do navegador. | Evento elegível → notificação persistida; push apenas quando permitido. | RF170–172 |
| BR-052 | Relatórios respeitam tenant, papel, filial, equipe, corretor e período. | Consulta → filtros de segurança são aplicados antes dos filtros de interface. | RF070–073, RF103 |
| BR-053 | Exportação não é bloqueada por papel, mas sempre é auditada. | Exportação → loga ator, momento, filtros e quantidade. | RF191 |
| BR-054 | Taxa de perda anormal compara corretor com referência configurável da equipe/filial. | Desvio excede limite → alerta para Gestor/Diretor. | RF193, RF199–200 |
| BR-055 | Reengajamento de perdido obedece prazo e canal aprovados, com conteúdo neutro. | Prazo configurado alcançado → cria ação de reengajamento auditável. | RF195 |
| BR-056 | Relatório de evidências preserva timeline, status e mensagens autorizadas do lead. | Solicitação autorizada → gera exportação auditada e limitada ao escopo. | RF197 |
| BR-057 | A plataforma deve disponibilizar termos públicos que delimitem uso do CRM, responsabilidades operacionais e tratamento de dados. | Acesso a `/termos` → informa a versão, uso permitido, papéis de proteção de dados e canal a ser formalizado pelo contratante. | DEC-032 |

| BR-058 | O canal oficial de WhatsApp é resolvido pelo `phone_number_id` previamente registrado pela Meta, e nunca por identificador de tenant enviado pelo navegador ou webhook. | Webhook assinado → encontra canal ativo pelo identificador da Meta; somente então persiste mensagens do tenant correspondente. | DEC-033 |
| BR-059 | Tokens de canal oficial permanecem exclusivamente no servidor, cifrados em repouso, e não entram em logs de auditoria ou respostas de API. | Embedded Signup concluído → token é cifrado antes da persistência; UI recebe somente estado e metadados permitidos. | DEC-033 |
| BR-060 | Enquanto a migração estiver ativa, o canal Meta oficial tem precedência para envio na unidade; OpenWA é fallback somente quando não há canal oficial ativo. | Envio de mensagem → seleciona canal Meta ativo por tenant/unidade/owner; sem canal oficial, usa conexão legada existente. | DEC-033 |
| BR-061 | Enquanto o chat interno estiver em desenvolvimento, ele não pode sugerir sincronização de mensagens. O Corretor inicia o atendimento pelo fluxo auditado e é direcionado ao WhatsApp pessoal pelo telefone autorizado do lead. | Lead distribuído → Corretor inicia atendimento → status e auditoria são persistidos → `wa.me` abre o WhatsApp Web ou o app conforme o dispositivo. | DEC-009 / DEC-033 |

## Regras que exigem decisão antes do código

- Transições exatas de funil e permissões por transição (DEC-001).
- Critério de round-robin, desempate e reatribuição (DEC-002).
- Relógio, calendário e efeitos de cada SLA (DEC-003).
- Fórmula, vigência e reversão de comissões (DEC-004).
- Base legal, retenção e consentimento LGPD (DEC-005).
- Canal, aprovação e opt-out do reengajamento (DEC-006).

## Feedback e lembretes

| ID | Regra | Gatilho → resultado | Origem |
|---|---|---|---|
| BR-046 | Lembrete de feedback usa intervalo configurável por tenant. | Job roda a cada ciclo → notifica corretores com leads ativos sem feedback no período. | DEC-030 |
| BR-047 | Número máximo de lembretes por lead é configurável por tenant. | Contador de notificações no intervalo ≥ máximo → mensagem escala para urgente. | DEC-030 |
| BR-048 | Push de lembrete de feedback respeita flag por tenant e capacidade global. | Flag do tenant + capacidade global ativas → push enviado; qualquer uma desativada → apenas toast/in-app. | DEC-030 / DEC-028 |
| BR-049 | Toast de lembrete de feedback respeita flag por tenant. | Flag desativada → notificação in-app não é criada. | DEC-030 |
| BR-050 | Após exceder tentativas máximas, o lembrete altera título para "urgente" e avisa sobre risco de redistribuição. | Tentativas ≥ máximo → notificação com tom de urgência elevado. | DEC-030 |
