# Guia simples — conectar WhatsApp e anúncios ao AncoraHub

Este guia é para a empresa cliente. Ele não pede senha, App Secret ou token do cliente. O AncoraHub usa um aplicativo técnico próprio e o cliente apenas libera os ativos corretos.

## Antes de começar

Você precisa ser administrador do Portfólio Empresarial da empresa e ter acesso à Página do Facebook, à conta de anúncios e ao número de WhatsApp Business. Separe o nome da unidade que deve receber os novos contatos.

## Parte 1 — liberar anúncios e formulários de lead

1. Abra [Configurações do negócio](https://business.facebook.com/settings/).
2. Em **Usuários → Parceiros**, adicione o parceiro técnico informado pela equipe AncoraHub.
3. Compartilhe a **Página do Facebook** e, se houver campanhas, a **Conta de anúncios**. Conceda as permissões necessárias para gerenciar os ativos.
4. Na Página, abra **Integrações → Acesso a Leads**. Em **CRMs**, permita o aplicativo AncoraHub. Sem esta autorização, a Meta pode avisar sobre o lead, mas bloqueia a leitura dos dados do formulário.
5. Envie à equipe AncoraHub somente os identificadores não sensíveis: **Page ID** e, opcionalmente, **Ad Account ID**. Não envie senhas, token, App Secret ou código de autenticação.
6. No AncoraHub, o Diretor abre **Configurações → Integrações → Meta → Marketing**, informa a Página e escolhe a unidade de destino. Sem unidade, o lead entra na fila geral da empresa.
7. A equipe AncoraHub configura o webhook `Page → leadgen` no aplicativo técnico. Depois disso, faça um teste com um formulário de teste da Meta e confirme o novo lead em **Leads**.

## Parte 2 — conectar o WhatsApp oficial

1. Abra [Meta for Developers](https://developers.facebook.com/), selecione o aplicativo informado pela equipe AncoraHub e entre em **WhatsApp → API Setup**.
2. Crie ou selecione a conta WhatsApp Business e valide o número por SMS ou ligação.
3. Copie os quatro itens solicitados no AncoraHub: **Business Manager ID**, **WABA ID**, **Phone Number ID** e o **Access Token** autorizado para WhatsApp Business.
4. No AncoraHub, abra **Configurações → Integrações → Meta → Geral**, cole os quatro dados e use **Testar conexão** antes de salvar.
5. Em **Webhooks**, copie a URL e o Verify Token exibidos pelo AncoraHub para a área WhatsApp do aplicativo Meta e assine o evento `messages`.
6. Envie uma mensagem de teste para o número oficial e confira o diagnóstico no AncoraHub.

## Como conferir se está pronto

Na aba **Diagnóstico** do AncoraHub, confirme:

- WhatsApp: Business, WABA, token, número e webhook estão como OK.
- Anúncios: a Página está ativa, o último webhook foi recebido e o último lead tem uma data.

Se uma Página estiver conectada a uma empresa errada, pause-a no AncoraHub antes de solicitar a transferência. Uma mesma Página não pode alimentar duas empresas ao mesmo tempo.

## Problemas comuns

| Situação | O que fazer |
| --- | --- |
| O formulário recebeu contato, mas o lead não apareceu | Confirme **Acesso a Leads → CRMs** na Página e peça para a equipe verificar o diagnóstico. |
| O número WhatsApp não valida | Confirme que o Phone Number ID é o identificador técnico, não o número exibido. |
| Meta recusa o webhook | Confirme que a URL e o Verify Token foram copiados sem espaços e que o evento correto foi assinado: `messages` para WhatsApp, `leadgen` para Página. |
| O lead foi para a fila errada | Ajuste a unidade de destino na fonte de Lead Ads; novos leads seguirão a configuração atual. |

## Segurança

Nunca compartilhe senha do Facebook, App Secret, token técnico da plataforma ou código de autenticação por WhatsApp/e-mail. O token de anúncios é administrado pelo AncoraHub em ambiente privado. O token de WhatsApp é cifrado e não volta a aparecer depois de salvo.
