# Documentos visíveis ao corretor — 22/07/2026

## Causa

`src/app/(dashboard)/documentos/page.tsx` redirecionava todo usuário com papel `broker` para `/access-denied` antes de executar a consulta. Isso contradizia o fluxo de atendimento: o corretor precisa consultar documentos dos leads atribuídos e dos clientes originados por esses leads.

## Correção

- A página passou a aceitar `broker`.
- `getPendingDocuments()` usa `leads.corretor_id = context.userId` para o corretor e retorna os documentos não excluídos da própria carteira.
- Gestores e diretores continuam vendo a fila de pendências no escopo atual.
- Ações de aprovação/rejeição e configuração de requisitos continuam indisponíveis para corretor.
- Upload e download mantêm validação server-side por tenant e responsável.

## Segurança

Nenhum identificador de tenant, papel ou corretor é aceito do navegador como autoridade. O filtro é derivado da sessão no servidor. Leads de outros corretores e outras empresas continuam invisíveis.

## Validação

- `npm run type-check`
- `npm test` — 111 testes aprovados
- `npm run build`
