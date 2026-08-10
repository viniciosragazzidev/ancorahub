# Integração Meta guiada em Integrações

## Entrega

- A configuração Meta foi movida para `/integrations/meta`.
- `/settings/meta` continua disponível apenas como redirecionamento, preservando links antigos e favoritos.
- O catálogo de Integrações aponta Meta Business, Lead Ads e WhatsApp Oficial para a nova rota.
- Lead Ads fica em `/integrations/meta`; o WhatsApp Oficial e WAHA ficam em `/integrations/whatsapp`, com a rota antiga também redirecionando.
- Os dois fluxos mostram objetivo, links oficiais, dados necessários e o que o Diretor deve aguardar da Ancora Hub.

## Segurança

- A autorização segue derivada do contexto de sessão e da capability `acessar_integracao_meta`.
- Tokens e demais credenciais privadas continuam sendo inseridos apenas no formulário protegido e não aparecem no guia, nos links ou em logs de interface.
- Lead Ads continua dependente do kill switch e do piloto individual liberado pelo Super-admin.

## Validação

- A preencher após type-check, teste do catálogo e build remoto.
