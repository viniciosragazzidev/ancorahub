# Status da conta WhatsApp empresarial

## Objetivo

A área de WhatsApp do Diretor usa a conta oficial da Meta como fonte principal para
decisão operacional. A visualização deve responder rapidamente se a conta está ativa,
pausada, incompleta ou ainda não conectada.

## Dados exibidos

- situação operacional da conta;
- nome verificado e número oficial;
- qualidade e limite de mensagens;
- Business ID, WABA ID e Phone Number ID;
- data de ativação e último webhook recebido.

Os dados são consultados no servidor com escopo do tenant. Tokens e material de
criptografia nunca são enviados ao navegador, registrados em logs ou exibidos na UI.

## Governança

Somente o Super Admin pode validar, conectar, substituir ou desconectar a conta oficial
de um tenant. O Diretor consulta apenas o status operacional, número e nome verificados,
qualidade e sincronização; não recebe WABA ID, Phone Number ID, Access Token ou App Secret.
Todas as mutações são validadas no servidor e registradas em auditoria. O Super-admin
também pode desativar a capacidade por feature flag.

O painel administrativo fica em `/super-admin/integrations/whatsapp` e lista todos os
tenants, permitindo selecionar uma empresa, validar a WABA e o número diretamente na
Meta e salvar o canal somente depois da confirmação. O token informado pelo operador é
usado na requisição, cifrado com a chave do ambiente e nunca é incluído em retorno,
metadata ou logs.

## Legado

A conexão QR é apresentada em um card separado como conexão pessoal legada opcional.
Ela não representa nem altera o status da conta empresarial.
