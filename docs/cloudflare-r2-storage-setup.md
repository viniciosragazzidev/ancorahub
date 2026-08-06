# Armazenamento de documentos no Cloudflare R2

O CorreTop grava o arquivo no bucket privado do Cloudflare R2 e mantém apenas os
metadados, o vínculo com lead/cliente/beneficiário e o checksum em
`lead_documents`. O acesso sempre passa pelas rotas autenticadas do servidor.

## Configuração por ambiente

1. No Cloudflare, crie o bucket privado `corretop-files` com a classe **Standard**.
   Não habilite domínio público nem acesso anônimo.
2. Crie um token R2 S3 com permissões **Object Read & Write**, limitado a esse
   bucket, e guarde Access Key ID e Secret Access Key apenas no ambiente servidor.
3. No ambiente do servidor (Vercel, Render ou VPS), configure:

   ```env
   R2_ACCOUNT_ID=identificador_da_conta_cloudflare
   R2_ACCESS_KEY_ID=access_key_privada
   R2_SECRET_ACCESS_KEY=secret_access_key_privada
   R2_BUCKET=corretop-files
   ```

4. Faça um upload autenticado e confirme que o objeto aparece no prefixo
   `documents/<tenantId>/` no bucket privado. O link salvo em
   `lead_documents.file_url` é interno e não é uma URL pública.

## Segurança operacional

- Não habilite acesso público, domínio público ou política anônima de leitura.
- As chaves S3 ficam apenas no servidor; o browser envia o arquivo para
  `/api/documents/upload`.
- A rota valida tenant, filial/carteira, tipo, tamanho e checksum antes de
  registrar o documento.
- Downloads passam por `/api/documents/download` e revalidam a sessão e o
  escopo do lead antes de buscar o objeto.
- Ações de upload, revisão e exclusão registram auditoria sem armazenar o
  conteúdo do arquivo.

O Super-admin pode pausar `feature_r2_storage_enabled` em **Configurações da
Plataforma**; isso interrompe leituras e uploads sem apagar dados. Se as chaves
não estiverem configuradas, o upload deve retornar `503` sem criar
registro incompleto no banco.
