# Restauração do cadastro do WhatsApp oficial

## Diagnóstico

O commit `877b2d1c` mudou a cadeia que disponibiliza o Embedded Signup. A
comparação com `V1.5_02/09`, a última referência informada como funcional,
identificou alterações na página de conexão, no card e na leitura do Config ID.

## Correção

Os arquivos foram restaurados à regra funcional: o Diretor vê a conexão apenas
quando a Meta está configurada, não existe número oficial ativo e há App ID e
Config ID. A abertura mantém o contrato WhatsApp v4 da Meta, incluindo a etapa
de seleção de WABA e número.

## Operação

`NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID` é uma variável de build
no Dockerfile. O valor implantado deve ser o Config ID do produto WhatsApp,
não uma configuração genérica de Login for Business. Não há migration, dados ou
segredos alterados nesta restauração.

## Rollback

Reverter os arquivos desta entrega restaura o comportamento anterior à
restauração.
