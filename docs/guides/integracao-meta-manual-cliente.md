# Guia completo — conectar formulários Meta Lead Ads ao AncoraHub

Este guia conecta os formulários de anúncio do Facebook e Instagram ao AncoraHub. Quando a integração estiver ativa, cada novo formulário cria um lead na fila central da empresa.

Não é necessário — e não é permitido — enviar senha do Facebook, App Secret, token, código de autenticação ou qualquer dado de cliente ao suporte.

## Quem faz cada parte

| Responsável | O que faz |
| --- | --- |
| **Diretor da empresa** | Compartilha a Página que recebe os formulários e, no AncoraHub, escolhe a Página que vai gerar leads. |
| **Ancora Hub / Super-admin** | Confere o acesso técnico da plataforma, atualiza a credencial quando necessário e confirma que a Página apareceu para o Diretor. |
| **Gestor e Corretor** | Não precisam configurar a integração. Eles recebem e trabalham os leads depois da ativação. |

## Antes de começar

O Diretor precisa:

- ser administrador do Portfólio Empresarial que é dono da Página;
- saber qual Página recebe os formulários dos anúncios;
- estar em uma empresa liberada para o piloto de Meta Lead Ads no AncoraHub.

> WhatsApp Oficial e Lead Ads são integrações separadas. Não é preciso conectar um número de WhatsApp para receber leads de formulário.

## Parte 1 — Diretor: compartilhar a Página com a Ancora Hub

1. Abra as [Configurações do negócio da Meta](https://business.facebook.com/settings/).
2. Confirme que está no **Portfólio Empresarial da sua empresa** — por exemplo, `Ancora Saúde` — e não no portfólio `Ancora Hub`.
3. Abra **Usuários → Parceiros** e escolha **Adicionar**.
4. Informe o Business ID da plataforma Ancora Hub: **37173915645589885**.
5. Escolha a **Página do Facebook** que recebe os formulários e conclua o compartilhamento.

Conta de anúncios, Pixel e Dataset são opcionais nesta primeira configuração. Compartilhar somente a Página já permite receber os formulários.

### O que o Diretor deve conferir antes de continuar

Na lista de parceiros, a `Ancora Hub` deve aparecer com acesso à Página escolhida. Se ela não aparecer, refaça o compartilhamento antes de seguir.

## Parte 2 — Aguarde a confirmação técnica da Ancora Hub

Depois de compartilhar a Página, o Diretor deve **aguardar a confirmação da Ancora Hub**. Esta etapa é feita pela plataforma e não pede token ao cliente.

A Ancora Hub irá:

1. localizar a Página compartilhada no Portfólio Empresarial `Ancora Hub`;
2. atribuí-la ao usuário técnico que usa a integração;
3. garantir que a credencial técnica tenha acesso a `leads_retrieval`, `pages_show_list`, `pages_read_engagement` e `pages_manage_metadata`;
4. atualizar a credencial de produção, quando necessário;
5. avisar o Diretor que a Página está disponível para ativação.

> Não tente colar o App ID ou o Business ID na área **Integrações → Acesso a leads → CRMs** da Meta. Essa tela não cadastra um aplicativo comum por ID e não é necessária para o fluxo guiado do AncoraHub.

## Parte 3 — Diretor: localizar e ativar a Página no AncoraHub

Após a confirmação da Ancora Hub:

1. Entre no AncoraHub com o perfil de **Diretor**.
2. Abra **Configurações → Integrações → Integração Meta** ou acesse `/settings/meta`.
3. Na área **Lead Ads**, clique em **Buscar ativos autorizados**.
4. Marque a Página encontrada.
5. Clique em **Ativar Página**. O AncoraHub associa automaticamente o aplicativo `Corretop API Oficial` à Página para receber formulários e só conclui a ativação depois da confirmação da Meta.

Uma Página só pode ficar ligada a uma empresa do AncoraHub por vez. Depois da ativação, o sistema registra a origem Meta e direciona os novos leads para a fila central da empresa.

## Parte 4 — Diretor: enviar um lead de teste

1. Abra a [ferramenta oficial de teste de Lead Ads da Meta](https://developers.facebook.com/tools/lead-ads-testing/).
2. Selecione a Página e o formulário de teste.
3. Envie um formulário com dados fictícios.
4. Volte ao AncoraHub e abra **Leads**.
5. Confirme que o novo lead chegou com origem **Meta Lead Ads**.

O mesmo teste pode ser reenviado para verificar que o sistema não cria um lead duplicado.

## Se a Página não aparecer no AncoraHub

### O Diretor deve conferir

- A Página certa foi compartilhada com a `Ancora Hub` usando o Business ID correto.
- A `Ancora Hub` continua visível em **Usuários → Parceiros** da Página.
- Está usando o perfil Diretor e a empresa está no piloto de Meta Lead Ads.

### O Diretor deve aguardar a Ancora Hub quando

- o botão **Buscar ativos autorizados** informa “Nenhuma Página encontrada”;
- a Página aparece na Meta, mas não no AncoraHub;
- houve troca de Página, de portfólio empresarial ou de usuário técnico.

Nesses casos, não compartilhe token nem tente criar um CRM manualmente. Informe apenas o nome e o ID da Página ao suporte da Ancora Hub pelo WhatsApp **+55 21 95930-7782**.

## Como remover ou trocar uma Página

O Diretor pode clicar em **Remover** ao lado da Página na lista **Páginas conectadas** dentro de `/settings/meta`. A remoção interrompe novos recebimentos e preserva o histórico de leads. Para conectar a mesma Página novamente, basta buscá-la e ativá-la outra vez. Para trocar de Página, remova a atual, compartilhe a nova Página e repita as Partes 2 e 3.

## Segurança e privacidade

- Tokens, App Secret e credenciais ficam somente no ambiente privado da Ancora Hub.
- O Diretor não envia nem armazena segredos no CRM.
- A Página é vinculada a uma empresa por vez e toda ativação, pausa ou troca fica registrada para auditoria.
