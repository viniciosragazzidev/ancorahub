# Plano de controle de aquisição Meta

## Objetivo

Transformar `/integrations/meta` no ponto claro para a corretora visualizar os ativos Meta autorizados e escolher, de forma reversível, quais deles representam sua operação. A distribuição continua em `/leads/distribuicao`, que é a única responsável por encaminhar leads para filas e corretores.

## Decisões aplicadas

- A Página conectada é a fonte de entrada. A corretora escolhe uma fonte já ativada para ser sua Página padrão.
- Conta de anúncios, pixel e dataset só podem ser escolhidos quando já foram sincronizados para o tenant. A ação não recebe `tenantId` do navegador e recusa qualquer ativo de outra empresa.
- A descoberta manual de Lead Ads continua validando somente a Página informada; a credencial técnica compartilhada não enumera carteiras globais.
- A sincronização da conexão canônica passa a armazenar pixels por conta de anúncios e datasets apenas abaixo do Business confirmado para o tenant.
- A tela deixa explícito que escolher um pixel ou dataset não envia eventos de conversão. CAPI continua deliberadamente desativada até consentimento, contrato e homologação.
- Os números comerciais não estimam conversas por percentual: o indicador usa leads em status comercial ativo até que a atribuição de conversas seja persistida.

## Operação

1. O Diretor compartilha e ativa uma Página no assistente seguro.
2. Ativos que a conexão Meta do tenant sincronizar aparecem no inventário local.
3. O Diretor seleciona fonte, conta, pixel e dataset padrão e salva. A mudança é registrada na auditoria.
4. Para decidir a fila por campanha, ele abre a Central de distribuição; a campanha aponta para uma fila, nunca diretamente para um corretor.

## Reversão

Desmarcar ativos padrão só altera `meta_integration_settings`; não remove fontes, campanhas, leads ou histórico. Pausar a fonte interrompe novos recebimentos e preserva a auditoria existente.

## Validação

- `npm run db:check`
- `npm run type-check`
- `npx vitest run src/features/communication-channels/meta-lead-ads.test.ts src/features/lead-distribution/domain.test.ts`
