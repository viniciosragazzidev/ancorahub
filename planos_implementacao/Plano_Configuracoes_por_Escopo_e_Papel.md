# Plano — Configurações por escopo, unidade e papel

## Objetivo

Separar configurações pessoais, configurações da unidade, identidade da corretora e integrações globais. A regra deve funcionar em página, drawer, plugin e API, sempre com autorização no servidor, isolamento por tenant, auditoria e governança do Super-admin.

## Decisão de domínio

- **Conta**: dados e segurança do usuário autenticado.
- **Conexão pessoal**: WhatsApp usado pelo usuário para atendimento. O modelo atual é `whatsapp_connections(tenant_id, user_id)`; cada usuário controla apenas a própria sessão.
- **Unidade/filial**: regras operacionais limitadas à `branch_id` da associação do usuário.
- **Identidade da corretora**: nome, razão social, CNPJ, logo e cor; pertencem ao tenant e só podem ser alterados pelo Diretor.
- **Integração global**: tokens de captura, webhooks e integrações que afetam toda a corretora; somente Diretor.

## Matriz de acesso

| Área | Corretor | Gestor | Diretor | Super-admin |
|---|---|---|---|---|
| Minha conta e 2FA | própria | própria | própria | diagnóstico auditado |
| WhatsApp pessoal | própria sessão | própria sessão | própria sessão | suporte técnico auditado |
| Configuração da unidade | não | unidade vinculada | todas | todas, com governança |
| Logo, nome, CNPJ e cor | não | não | editar tenant | política global |
| Tokens/webhooks de captura | não | não | tenant completo | visualizar/desativar auditado |
| Equipe | não | unidade conforme regra | toda a corretora | toda a plataforma |
| Auditoria | eventos próprios | unidade permitida | tenant | global |

## Correções entregues nesta fatia

1. `/settings` passou a ser uma área por perfil: corretor vê conta, WhatsApp próprio e segurança; gestor vê também o contexto da unidade; diretor vê Empresa, Unidades e Integrações globais.
2. A logo e a cor continuam protegidas no servidor por `updateTenantBrandingAction`, com auditoria; a aba Empresa não é renderizada para gestor ou corretor.
3. Os sidebars exibem Configurações com permissão declarada.
4. `/conversas` continua disponível sem WhatsApp, mas informa que a consulta está liberada e o envio bloqueado. O composer fica desabilitado e a Server Action valida novamente a conexão.

## Regras invariantes

- Nunca aceitar `tenant_id`, `branch_id` ou `user_id` de formulário para decidir escopo.
- Toda query combina o tenant autenticado e, para gestor/corretor, a unidade ou usuário aplicável.
- Toda ação de branding, permissões, integrações, conexão/desconexão e configuração operacional gera auditoria sem segredo ou QR Code.
- Ocultar no menu não substitui autorização no servidor.
- Uma conexão WhatsApp nunca pode ser consultada ou alterada por outro usuário.

## Fases seguintes

### Fase 1 — fundação e contenção (implementada)

Matriz granular, abas por papel, proteção server-side, aviso de WhatsApp e auditoria das mutações existentes.

### Fase 2 — configurações operacionais por unidade

Criar `getUnitSettings`, `updateUnitSettings` e `previewUnitSettings`; persistir horário, capacidade, SLA, recebimento de leads e preferências locais; gestor altera apenas sua unidade e Diretor qualquer unidade. Toda alteração terá versão, autor, motivo e reversão.

### Fase 3 — governança

Painel do Super-admin por tenant/unidade/usuário, feature flags com fallback seguro, alertas de tentativas negadas e exportações auditadas.

### Fase 4 — Plugin First

Expor use cases de configurações, manifests com permissões/escopo/eventos e eventos `unit.settings.updated`, `tenant.branding.updated`, `user.whatsapp.connected` e `user.whatsapp.disconnected`.

## Casos de borda

- Usuário sem filial não pode abrir configuração de unidade.
- Gestor multi-filial permanece bloqueado até DEC-012 definir a política.
- Usuário desativado falha no contexto antes da leitura.
- WhatsApp desconectado permite histórico, mas bloqueia envio e automações de saída.
- Troca de papel invalida cache de navegação e revalida o servidor.
- Ações do Super-admin devem declarar tenant e ser auditadas.

## Testes de aceite

- Corretor não vê Empresa, Unidade, Equipe, Filiais ou Integrações globais e vê Configurações.
- Gestor não altera logo, cor, nome, CNPJ ou tokens por URL ou request manual.
- Diretor edita branding e integrações do próprio tenant.
- Usuário sem WhatsApp consulta conversas, vê aviso e recebe rejeição server-side ao enviar.
- Conexão de outro usuário nunca é retornada.
- Mutações sensíveis geram auditoria sem segredo em logs.

## Pendências controladas

- Definir parâmetros editáveis da unidade e sua precedência em relação ao tenant.
- Resolver DEC-012 para gestores multi-filial.
- Conectar a superfície global do Super-admin a todas as feature flags e relatórios.
