# Verificação: opt-out atômico e pedido de texto único

Branch: `feat/pos-venda-auditoria`. Nenhuma escrita no banco.

- `npx tsc --noEmit`: aprovado; `DATABASE_URL` e `SUPABASE_DB_URL` removidos do processo.
- Vitest focado: 3 arquivos, 26 testes aprovados. Cobertura para falha ao gravar opt-out sem mudar o status e dois áudios no mesmo passo com um pedido de texto. Nenhum teste de banco executado.
- ESLint nos arquivos alterados: 0 erros e 0 avisos.
- `git diff --check`: aprovado.
- `drizzle/0220_post_sale_opt_out_retry.sql` atualizado com `media_text_prompt_step`; não executado.
- Sem push.
