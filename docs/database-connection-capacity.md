# Capacidade de conexões do banco

O erro `EMAXCONN` indica que o limite de conexões do projeto foi atingido. A correção
aplicada limita cada instância de runtime a uma conexão por padrão, reduz o tempo de
ociosidade para cinco segundos e evita consultas repetidas da sessão no proxy por
cinco segundos.

## Configuração recomendada

- Use a URL do pooler do Supabase (não a conexão direta) em `DATABASE_URL`.
- Não defina `DB_POOL_MAX` em produção inicialmente; o padrão é `1`.
- Se o plano do banco permitir mais conexões, aumente gradualmente para `2` ou `3`.
- Após publicar, reinicie/reimplante o serviço para encerrar as conexões antigas.

A cache do proxy não armazena leads, permissões ou dados pessoais; ela só reduz a
consulta repetida do token de sessão por alguns segundos.
