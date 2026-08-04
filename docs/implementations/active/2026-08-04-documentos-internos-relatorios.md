# Documentos internos em Relatórios

**Data:** 2026-08-04
**Status:** em validação

## Objetivo

Permitir que Diretores e Gestores guardem PDFs de apoio dentro da área de
Relatórios, sem expor os arquivos publicamente.

## Entrega

- Importação de PDFs pela página `/relatorios`.
- Armazenamento privado no provedor de documentos já utilizado pelo CRM.
- Registro do arquivo, tamanho, tipo, checksum e responsável pelo envio.
- Download autenticado, sempre limitado à empresa do usuário.
- Auditoria do envio do documento.

## Regras de segurança

- Apenas usuários com permissão para exportar relatórios podem enviar ou baixar
  esses documentos.
- O tenant é obtido da sessão no servidor; o navegador nunca informa o tenant.
- Aceita somente PDF, com limite de 15 MB.
- A URL do arquivo não é pública.

## Validação prevista

- Type-check e build de produção.
- Conferência da migration que cria o registro dos documentos internos.
- Verificação manual do fluxo: enviar PDF fictício, visualizar na lista e baixar
  como usuário autorizado.
