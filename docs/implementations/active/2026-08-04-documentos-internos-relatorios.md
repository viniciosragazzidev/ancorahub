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

## Refinamento da tela — 2026-08-05

- A página passou a usar os cards compartilhados para métricas, exportação,
  planilhas e documentos internos, preservando contraste em light e dark mode.
- Foram adicionados gráficos de evolução comercial e receita ativa, ambos
  derivados exclusivamente das mesmas consultas de período já escopadas pelo
  servidor.
- Os gráficos apresentam estado vazio claro quando não houver dados e não usam
  animação automática, mantendo a leitura estável em uma tela operacional.
- A área de exportação mostra somente o download de comissões que já é
  funcional; exportações ainda não disponíveis não são apresentadas como ação.

### Arquivos principais

- `src/app/(dashboard)/relatorios/page.tsx`
- `src/app/(dashboard)/relatorios/_components/report-trend-charts.tsx`
- `src/app/(dashboard)/relatorios/_components/export-buttons.tsx`

### Validações executadas

- `npx eslint` nos componentes de relatórios: sem erros; dois avisos
  preexistentes no uploader de planilhas.
- `npx tsc --noEmit --pretty false --incremental false`: aprovado.
- `npm run build`: aprovado, com 76 rotas geradas.
