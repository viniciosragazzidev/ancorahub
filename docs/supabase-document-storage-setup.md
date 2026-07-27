# Armazenamento de documentos no Supabase

O CorreTop grava o arquivo no bucket privado `documents` e mantém apenas os
metadados, o vínculo com lead/cliente/beneficiário e o checksum em
`lead_documents`. O acesso sempre passa pelas rotas autenticadas do servidor.

## Configuração por ambiente

1. No Supabase, abra **Project Settings → API** e copie a chave **service_role**
   (nunca a publique no navegador, Git ou `NEXT_PUBLIC_*`).
2. No ambiente do servidor (Vercel, Render ou VPS), configure:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=chave_service_role_do_projeto
   SUPABASE_DOCUMENTS_BUCKET=documents
   ```

3. Aplique as migrations com `SUPABASE_DB_URL` apontando para o banco do mesmo
   projeto. A migration `0080_supabase_documents_storage.sql` cria ou corrige o
   bucket privado, limite de 10 MB e os tipos PDF/JPG/PNG.
4. Faça um upload autenticado e confirme que o arquivo aparece em **Storage →
   documents** com o cadeado de bucket privado. O link salvo em
   `lead_documents.file_url` é interno e não é uma URL pública.

## Segurança operacional

- Não habilite o bucket como público e não crie política anônima de leitura.
- O `service_role` fica apenas no servidor; o browser envia o arquivo para
  `/api/documents/upload`.
- A rota valida tenant, filial/carteira, tipo, tamanho e checksum antes de
  registrar o documento.
- Downloads passam por `/api/documents/download` e revalidam a sessão e o
  escopo do lead antes de buscar o objeto.
- Ações de upload, revisão e exclusão registram auditoria sem armazenar o
  conteúdo do arquivo.

Se a chave não estiver configurada, o upload deve retornar `503` sem criar
registro incompleto no banco.
