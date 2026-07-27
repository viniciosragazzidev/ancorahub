# Supabase

Clientes e configurações do Supabase separados por ambiente de execução.

- `client.ts`: uso no navegador.
- `server.ts`: uso no servidor.
- `middleware.ts`: integração com o middleware da aplicação.
- `config.ts`: leitura segura de configuração.

Segredos nunca podem ser exportados por módulos client-side.
