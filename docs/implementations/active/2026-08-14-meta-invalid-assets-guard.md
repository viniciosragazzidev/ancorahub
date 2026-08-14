# Guarda de ativos Meta inválidos na sincronização

## Objetivo

Impedir que espelhos locais de teste ou corrompidos, como `act_mock_789` e
`page_mock_456`, sejam enviados à Graph API e gerem falhas repetidas no cron de
sincronização.

## Escopo

- IDs de contas de anúncios aceitam apenas o formato numérico da Meta, com ou sem
  o prefixo `act_`.
- IDs de Páginas, empresas e demais objetos Graph usados pela sincronização devem
  ser numéricos.
- Registros ativos inválidos são marcados como inativos de forma reversível antes
  de qualquer requisição externa.
- O sincronizador registra um aviso operacional `invalid_asset`; não há exposição
  de token nem chamada à Meta para o ID inválido.

## Validações

- Teste unitário dos formatos aceitos e rejeitados.
- Teste do cliente Graph garantindo que IDs mock não iniciam uma requisição.
- Type-check executado após a alteração.

## Operação e rollback

O próximo ciclo de sincronização desativa os espelhos inválidos automaticamente,
preservando histórico e permitindo reativação ao reconectar e selecionar ativos
reais. A mudança é limitada ao tenant e à conexão que possui o registro.
