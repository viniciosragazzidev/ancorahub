# CorreTop — CRM para Corretoras de Planos de Saúde
## Documento de Requisitos e Fluxos de Produto (PRD) para Geração de Testes Automatizados

Este documento descreve detalhadamente a arquitetura do CorreTop, suas regras de negócio e os fluxos operacionais de ponta a ponta (E2E) para servir como entrada para ferramentas de geração de testes e QA.

---

## 1. Visão Geral do Produto e Arquitetura

O **CorreTop** é uma plataforma SaaS multi-tenant (B2B2B) para corretoras de planos de saúde. O sistema gerencia toda a jornada do lead, desde a captação (webhook ou manual), distribuição por rodízio (Round-Robin), atendimento, cotação de planos, validação de documentos, fechamento da venda e cálculo de comissões recorrentes.

### 1.1 Hierarquia de Usuários (Roles)
O sistema possui 3 papéis principais dentro de cada corretora (tenant), com controle de acesso rígido no servidor:
1. **Diretor (Administrador do Tenant)**: Tem acesso irrestrito ao tenant. Pode cadastrar e gerenciar filiais (branches), convidar/desativar membros de qualquer nível e visualizar relatórios consolidados de todas as filiais.
2. **Gestor (Gerente de Unidade)**: Gerencia uma ou mais filiais. Pode convidar/gerenciar corretores para as suas filiais e acompanhar relatórios consolidados de suas unidades.
3. **Corretor (Vendedor Final)**: Vinculado a apenas uma filial. Visualiza somente os seus próprios leads e clientes. Pode pausar/retomar sua disponibilidade para novos leads.

### 1.2 Regra Geral de Multi-Tenancy (Isolamento de Dados)
Todo dado operacional pertence obrigatoriamente a um `tenant_id`. Nenhuma requisição ou query do cliente pode especificar o `tenant_id` diretamente no corpo ou nos parâmetros da query. O servidor resolve o `tenant_id` de forma segura a partir da sessão ativa do usuário. Qualquer tentativa de acesso a dados de outro tenant resulta em **Acesso Negado (403)**.

---

## 2. Dicionário de Status e Entidades

### 2.1 Funil de Status do Lead (Pipeline)
A jornada do lead progride sequencialmente pelas etapas abaixo:
*   `new` (Novo): Lead inserido no sistema, aguardando distribuição automática.
*   `distributed` (Distribuído): Lead atribuído a um corretor específico, aguardando início do contato.
*   `in_contact` (Em contato/Em atendimento): Corretor iniciou o contato (via atalho de WhatsApp).
*   *Atendimento Ativo*: leads nos status `in_contact`, `quote_sent`, `negotiation`, `documentation_pending` ou `under_analysis`.
*   `quote_sent` (Cotação enviada): Cotação de planos de saúde gerada e compartilhada com o cliente.
*   `negotiation` (Negociação): Alinhamento de valores, coparticipação e carências.
*   `documentation_pending` (Documentação pendente): Cliente enviando documentos solicitados pelo corretor.
*   `under_analysis` (Em análise): Proposta e documentos enviados e sob análise da operadora.
*   `converted` (Convertido): Venda finalizada com sucesso. Gera um registro de Cliente Ativo e de Venda (Comissões).
*   `lost` (Perdido): Venda não concretizada. Requer preenchimento obrigatório do motivo de perda.

### 2.2 Status de Membros da Equipe
*   `active` (Ativo): Membro operando normalmente (se corretor, elegível para receber leads se estiver disponível).
*   `pending` (Pendente): Convite enviado por e-mail, aguardando primeiro login e senha.
*   `inactive` (Inativo): Acesso bloqueado pelo Diretor/Gestor. Não pode fazer login e é removido da fila de leads.

### 2.3 Status de Disponibilidade do Corretor
*   `available` (Disponível/Em plantão): Elegível para receber leads da sua filial no rodízio.
*   `paused` (Pausado): Não elegível para novos leads automáticos (mantém seus leads antigos).

---

## 3. Fluxos de Trabalho Ponta a Ponta (User Journeys)

---

### Fluxo 1: Autenticação, Centralização e Redirecionamento 2FA
*   **Atores**: Diretor, Gestor, Corretor.
*   **Rotas envolvidas**: `/login`, `/2fa`, `/dashboard`.
*   **Passos**:
    1. O usuário acessa `/login` e depara-se com um formulário centralizado com os campos: *E-mail*, *Senha*, checkbox *Lembrar de mim*, link *Esqueci a senha*, link *Termos de Uso* e *Política de Privacidade*.
    2. Insere as credenciais e clica em **Entrar**.
    3. Se o usuário tiver a Autenticação de Dois Fatores (2FA) desativada:
        *   O sistema cria a sessão e redireciona imediatamente para o `/dashboard`.
    4. Se o usuário tiver a Autenticação de Dois Fatores (2FA) ativada:
        *   O sistema exibe a página `/2fa`, solicitando o token de 6 dígitos.
        *   O usuário insere o código de segurança e clica em **Confirmar**.
        *   O sistema autentica, salva o cookie de sessão e redireciona para o `/dashboard`.
*   **Critérios de Aceite para Testes**:
    *   Se o usuário fizer login com credenciais erradas, deve exibir alerta de erro de credenciais.
    *   Se tentar acessar `/dashboard` sem estar logado, deve ser redirecionado para `/login`.
    *   O checkbox "Lembrar de mim" deve persistir a sessão mesmo após fechar o navegador.

---

### Fluxo 2: Gestão de Equipe e Filiais (Diretor & Gestor)
*   **Atores**: Diretor, Gestor.
*   **Rotas envolvidas**: `/equipe`, `/equipe/convidar`, `/filiais`.
*   **Passos**:
    1. O **Diretor** acessa `/equipe` e visualiza a tabela de membros com colunas: *Nome*, *E-mail*, *Cargo/Perfil*, *Filial vinculada*, *Status* (Ativo, Pendente, Inativo com ícones e cores), e *Ações*.
    2. Clica no botão **Adicionar Integrante**.
    3. No drawer/formulário de convite:
        *   Preenche *Nome*, *E-mail*, *Perfil* (Diretor, Gestor, Corretor) e *Cargo Organizacional*.
        *   Se o perfil selecionado for **Diretor**: a seleção de filial é desabilitada (Diretor tem acesso global).
        *   Se o perfil selecionado for **Gestor**: exibe um seletor múltiplo permitindo selecionar uma ou mais filiais (unidades) sob sua gerência.
        *   Se o perfil selecionado for **Corretor**: exibe um seletor simples que obriga a vincular o corretor a exatamente uma filial.
    4. Clica em **Enviar Convite**. O membro é criado com status `pending`.
    5. O destinatário recebe o convite, cria a senha na tela de aceite e seu status muda para `active`.
*   **Critérios de Aceite para Testes**:
    *   Um **Gestor** que tentar acessar `/filiais` ou convidar outro Gestor/Diretor deve receber erro de permissão negada.
    *   Ao desativar um membro da equipe (Ações -> Inativar), seu status na tabela deve mudar imediatamente para `inactive` e ele deve ter sua sessão encerrada imediatamente.

---

### Fluxo 3: Captação de Leads via Webhook Inbound (Integração)
*   **Atores**: Sistema externo (Meta Ads, Landing Page, etc.).
*   **Rotas envolvidas**: `/api/webhooks/leads` (Recomendada com Bearer Token) ou `/api/webhooks/leads/[tenantId]`.
*   **Passos**:
    1. O sistema parceiro realiza uma requisição `POST` para `/api/webhooks/leads` com cabeçalho `Authorization: Bearer <TOKEN_GERADO>` e o payload JSON:
        ```json
        {
          "name": "Mariana Costa",
          "phone": "+55 (21) 99999-9999",
          "email": "mariana@example.com",
          "source": "landing_page",
          "externalId": "lead-unique-12345",
          "planInterest": "Plano empresarial PME"
        }
        ```
    2. O servidor valida o Bearer Token contra o hash salvo e identifica o `tenantId` e a `branchId` vinculada à credencial.
    3. O servidor verifica a idempotência usando o campo `externalId`:
        *   Se o `externalId` já foi processado anteriormente para este tenant, o sistema retorna **sucesso (200 OK)** sem criar duplicatas (idempotência).
    4. O lead é inserido no banco de dados com status `new` e adicionado à fila de distribuição automática.
*   **Critérios de Aceite para Testes**:
    *   Chamadas com tokens inválidos ou sem cabeçalho de autenticação devem retornar **Não Autorizado (401)**.
    *   Dados sensíveis do payload do lead devem passar por validação de campos (Zod schema) antes da persistência.

---

### Fluxo 4: Distribuição Automática por Rodízio (Round-Robin) e SLAs
*   **Atores**: Sistema/Fila de Leads, Corretor.
*   **Rotas envolvidas**: Fundo de processamento de leads, `/minha-fila`.
*   **Passos**:
    1. Um lead chega na etapa `new`.
    2. O distribuidor consulta os corretores elegíveis vinculados àquela filial:
        *   Devem estar ativos (`status = 'active'`).
        *   Devem estar disponíveis no plantão (`availabilityStatus = 'available'`).
    3. O rodízio Round-Robin avalia quem tem a menor quantidade de leads ativos em atendimento. Em caso de empate, o lead é atribuído ao corretor com maior tempo desde a última atribuição.
    4. O lead é reatribuído para o corretor escolhido:
        *   O status do lead muda para `distributed`.
        *   É criado um log de auditoria interna da distribuição e um evento na timeline do lead.
    5. Se nenhum corretor estiver disponível no momento:
        *   O lead permanece no status `new` com responsável vazio, aparecendo como "Aguardando Distribuição" na tela dos gestores.
*   **Critérios de Aceite para Testes**:
    *   Um corretor com status `paused` **nunca** deve receber novos leads da fila automática.
    *   **Monitoramento de SLA**: Se o corretor não iniciar o contato dentro do prazo limite parametrizado pelo tenant (ex: 15 minutos):
        *   O lead é reclassificado para "Não Trabalhado".
        *   Uma notificação in-app é enviada ao Gestor e o lead entra na fila de "Retrabalho".

---

### Fluxo 5: Atendimento do Lead e Redirecionamento WhatsApp
*   **Atores**: Corretor.
*   **Rotas envolvidas**: `/minha-fila`, `/leads/[id]`.
*   **Passos**:
    1. O corretor visualiza o lead em `/minha-fila` (ou resumo de operação).
    2. Clica no botão **Abrir** para ver os detalhes do lead.
    3. O corretor visualiza a timeline de histórico e clica no botão **Iniciar Atendimento / Chamar no WhatsApp**.
    4. O sistema processa o clique no servidor:
        *   Atualiza o status do lead de `distributed` para `in_contact` (Em atendimento).
        *   Registra o início da ação de atendimento e o timestamp na timeline do lead e no log de auditoria.
    5. O navegador abre uma nova aba redirecionando o corretor para a API externa do WhatsApp: `https://wa.me/<TELEFONE_DO_LEAD>?text=<MENSAGEM_SAUDACAO>`.
*   **Critérios de Aceite para Testes**:
    *   O corretor só pode ver o botão de iniciar contato dos leads que estão atribuídos a ele.
    *   A transição de status e o registro de auditoria devem ocorrer de forma síncrona antes de redirecionar o usuário para a página externa do WhatsApp.

---

### Fluxo 6: Cotação de Planos e Geração de PDF (Operadoras e Planos)
*   **Atores**: Corretor, Gestor, Diretor.
*   **Rotas envolvidas**: `/catalogo`, `/leads/[id]`, `/cotacoes`.
*   **Passos**:
    1. O administrador gerencia o catálogo em `/catalogo`:
        *   Pode cadastrar Operadoras (Allianz, Amil, etc.) com Código ANS, Status e dados de contato.
        *   Cadastra Planos dentro da operadora (Nome, Tipo [Familiar, Individual, Empresarial], Abrangência [Nacional, Estadual, Grupo de Municípios] e Status).
    2. O corretor acessa a página do Lead `/leads/[id]` e clica em **Gerar Cotação**.
    3. Seleciona a Operadora e escolhe os Planos aplicáveis.
    4. Configura as tabelas de faixas etárias/vidas (ex: quantidade de pessoas por idade 0-18, 19-23, etc.) e valores das mensalidades.
    5. Clica em **Salvar Cotação**.
        *   O sistema cria uma versão imutável da cotação associada ao lead.
    6. Clica em **Exportar PDF**. O sistema compila os dados comerciais e renderiza um documento PDF profissional com o cabeçalho do tenant.
*   **Critérios de Aceite para Testes**:
    *   Planos inativos no catálogo não devem aparecer como opção na geração de novas cotações.
    *   Cotações salvas anteriormente devem permanecer inalteradas mesmo que o preço do plano no catálogo seja atualizado (preservação histórica).

---

### Fluxo 7: Checklist Documental e Aprovação de Proposta
*   **Atores**: Corretor, Gestor.
*   **Rotas envolvidas**: `/leads/[id]`.
*   **Passos**:
    1. O lead avança para `documentation_pending`.
    2. O sistema gera automaticamente um checklist de documentos obrigatórios com base no tipo de plano selecionado (ex: RG, Comprovante de Residência, Declaração de Saúde).
    3. O corretor faz o upload dos arquivos pdf/imagens no detalhe do lead.
    4. Cada documento enviado é registrado com status `pending_review`.
    5. O **Gestor** ou **Diretor** acessa a ficha do lead:
        *   Visualiza os documentos enviados.
        *   Pode clicar em **Aprovar** (muda o status do documento para `approved`).
        *   Pode clicar em **Rejeitar** (muda o status para `rejected` e obriga a preencher uma observação detalhando o motivo).
    6. O lead só pode ser movido para o status `under_analysis` (Em análise da operadora) após todos os documentos obrigatórios do checklist estarem com status `approved`.
*   **Critérios de Aceite para Testes**:
    *   Bloquear o avanço do lead para `under_analysis` se houver documentos rejeitados ou não enviados.
    *   Exibir uma mensagem de erro clara indicando quais documentos estão pendentes.

---

### Fluxo 8: Conversão da Venda e Repasse de Comissões
*   **Atores**: Corretor, Gestor, Diretor.
*   **Rotas envolvidas**: `/leads/[id]`, `/financeiro`.
*   **Passos**:
    1. A operadora aprova a proposta do cliente.
    2. O corretor clica em **Marcar como Convertido** no detalhe do lead.
    3. O sistema:
        *   Altera o status do lead para `converted`.
        *   Cria uma entidade **Venda** vinculando o Corretor, a Filial, os Planos vendidos e o valor total do contrato.
        *   Gera o cronograma de comissões futuras com base nas regras do plano (ex: 100% da primeira parcela, 25% da segunda, 5% das parcelas subsequentes).
        *   Aplica as regras de divisão de repasse (Split): calcula os valores destinados ao Corretor (repasse), ao Gestor (sobrecomissão de equipe) e à Corretora (fração do tenant).
    4. O financeiro visualiza e gerencia esses pagamentos e repasses na rota `/financeiro`.
*   **Critérios de Aceite para Testes**:
    *   Se a venda for cancelada, o cronograma de parcelas futuras pendentes deve ser automaticamente estornado.
    *   As queries de comissões devem consolidar valores respeitando o isolamento por tenant.

---

### Fluxo 9: Governança, Logs de Auditoria e Desativação Global (Super-Admin)
*   **Atores**: Super-Admin (Suporte CorreTop), Diretor.
*   **Rotas envolvidas**: `/super-admin/audit`, `/super-admin/settings`.
*   **Passos**:
    1. O **Super-Admin** do CorreTop acessa `/super-admin/settings`.
    2. Pode ativar ou desativar recursos em tempo real para tenants específicos ou globalmente (ex: Módulo de WhatsApp, Motor de Comissões, Envio de Push).
    3. O **Diretor** do tenant tenta acessar a funcionalidade que foi desativada.
        *   O sistema intercepta a requisição e exibe uma tela amigável informando que o módulo está inativo ou indisponível.
    4. Qualquer alteração de permissão, exportação de dados (de leads ou relatórios) ou visualização de informações pessoais gera um registro na rota `/super-admin/audit` detalhando: *Usuário executor*, *Ação executada*, *Target*, *Data/Hora* e *Status*.
*   **Critérios de Aceite para Testes**:
    *   Garantir que a desativação de um módulo pelo painel do Super-Admin seja aplicada instantaneamente para todos os usuários do tenant afetado, sem necessidade de recompilação do código.
    *   Logs de auditoria não podem armazenar dados sensíveis em texto claro (LGPD compliance).

---
