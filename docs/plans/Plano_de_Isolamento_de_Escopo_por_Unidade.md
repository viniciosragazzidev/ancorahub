# Plano de isolamento de escopo por unidade

## Objetivo

Impedir que um usuário visualize, consulte, altere, exporte ou transfira dados fora do escopo permitido pelo seu papel e pela unidade à qual está vinculado.

A regra é aplicada no servidor. Filtros de tela são apenas uma camada de experiência e nunca substituem a autorização.

## Matriz de escopo

| Papel | Escopo de leitura | Escopo de alteração |
| --- | --- | --- |
| Super-admin | Plataforma inteira, com auditoria | Governança da plataforma e tenants |
| Diretor | Toda a corretora e todas as unidades do tenant | Equipe, unidades, distribuição, regras e configurações da corretora |
| Gestor | Apenas a unidade vinculada | Corretores, leads, tarefas, documentos, vendas e indicadores da própria unidade |
| Corretor | Apenas a própria carteira e tarefas atribuídas | Próprios leads, atendimento, tarefas e dados pessoais liberados pelo fluxo |

## Regras obrigatórias

1. Toda query deve filtrar primeiro pelo `tenantId` derivado da sessão.
2. Toda consulta de gestor deve incluir `branchId` derivado da sessão ou uma relação segura com a unidade.
3. Corretor deve ser limitado por `corretorId`, nunca por um identificador enviado pelo cliente.
4. Toda mutation deve buscar o registro e validar o escopo antes de alterar ou excluir.
5. Alterações de equipe só podem ocorrer dentro das unidades permitidas pelo papel.
6. Transferências de leads só podem ocorrer entre corretores ativos da mesma unidade.
7. Exportações, relatórios, dashboards e contagens devem usar a mesma regra de escopo dos registros exibidos.
8. Rotas de detalhe devem retornar `notFound` ou acesso negado quando o registro não pertence ao escopo.
9. Super-admin continua com visão global, mas as ações devem gerar auditoria.

## Correções aplicadas nesta etapa

- `/equipe`: gestores recebem somente membros e filial da própria unidade.
- Métricas de equipe: membros, leads sem atendimento e vendas passaram a respeitar a unidade.
- Criação de membro: gestor não pode escolher outra unidade.
- Transferência de leads: valida corretor ativo e mesma unidade; gestor não atravessa unidades.
- Contexto de sessão: acessos operacionais sem unidade são bloqueados.
- `/leads/[id]`: gestor e corretor não conseguem abrir detalhes fora do próprio escopo por URL direta.
- `/clientes`: gestor vê apenas clientes da unidade e corretor apenas sua carteira.
- `/relatorios`: contagens de leads, clientes, cotações, vendas e receita respeitam o escopo.
- Documentos e cotações vinculados a lead: leitura respeita a unidade/carteira.

## Auditoria restante por módulo

- Leads: revisar todas as actions de status, distribuição, exportação e busca por identificador.
- Conversas: manter o escopo baseado no lead e validar mutations de mensagens.
- Documentos: validar review individual e em lote por unidade antes da alteração.
- Cotações: validar compartilhamento, exportação PDF e consulta por ID.
- Vendas/financeiro: separar visão pessoal do corretor, unidade do gestor e corretora do diretor; validar também APIs internas e exportações.
- Metas e relatórios: aplicar escopo ao agregado e ao detalhe, sem calcular globalmente para gestor.
- Tarefas: garantir que `leadId` informado pelo cliente não atravesse o escopo.
- Integrações/webhooks: origem deve ser vinculada à unidade autorizada, sem aceitar `tenantId` ou `branchId` confiado do cliente.
- Notificações: recipient, tenant e lead devem ser validados conjuntamente.
- Sidebar e permissões: ocultação visual deve refletir a mesma matriz, sem ser a única proteção.

## Validação de regressão

Para cada módulo, testar com pelo menos:

- diretor com duas unidades;
- gestor da unidade A tentando abrir e alterar registro da unidade B;
- corretor tentando abrir registro de outro corretor;
- identificador válido de outro tenant;
- acesso direto por URL, action server-side e exportação.

O resultado esperado é `access-denied`, `notFound` ou conjunto vazio, sem vazamento de contagem, nome, telefone, e-mail, documento, venda ou comissão.
