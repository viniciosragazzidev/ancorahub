# Banco de dados CorreTop V2

- Schema Drizzle: `src/shared/db/schema.ts`.
- Migrations: `drizzle/`.
- Execução: `npm run db:migrate`.
- Bootstrap idempotente: `npm run bootstrap:tenant`.

O bootstrap cria uma corretora, sua matriz, a identidade BetterAuth do diretor, a
credencial de e-mail/senha e o vínculo `tenant_memberships` com papel `director`. Ele
recusa e-mails que já pertençam a outro tenant, preservando a regra de uma corretora por
sessão nesta fase.

Para desenvolvimento, use apenas dados fictícios nas variáveis `BOOTSTRAP_*` de
`.env.local` ou no ambiente do comando.
