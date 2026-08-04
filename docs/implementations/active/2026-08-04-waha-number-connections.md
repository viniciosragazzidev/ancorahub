# Conexões WAHA por empresa e unidade

## Entrega

- Diretor conecta números que pertencem à empresa inteira.
- Gestor conecta números somente para a própria unidade.
- Super-admin controla a capacidade global, de forma reversível e auditável.
- QR Code e status passam pelo relay na VPS; credenciais do WAHA não chegam ao navegador.

## Prontidão para produção

Configure WAHA_RELAY_URL e WAHA_RELAY_SHARED_SECRET na Vercel, além de
WAHA_API_KEY e o mesmo segredo no relay da VPS. Habilite Conexões WAHA no
Super-admin antes de conectar o primeiro número.
