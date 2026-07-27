# Refinamento transversal — 21/07/2026

## Resultado

Foi aplicada uma camada transversal de confiabilidade e orientação ao produto, sem alterar regras de negócio:

- estados de carregamento compartilhados na raiz, no dashboard e na administração de plataforma;
- tratamento de erro de rota com tentativa de recuperação, retorno seguro ao painel e referência de diagnóstico sem expor detalhes internos;
- fallback global para falhas fora da árvore React, mantendo `lang="pt-BR"` e uma ação de recuperação;
- estado de recurso inexistente separado de erro de servidor, com links de retorno previsíveis;
- componentes reutilizáveis em `src/components/route-loading.tsx`, `src/components/route-error.tsx` e `src/components/route-not-found.tsx`.

## Critérios de segurança

Os fallbacks não exibem stack trace, parâmetros de consulta, tokens ou dados de tenant. O digest do Next.js, quando disponível, é apenas uma referência de suporte. As páginas não executam consultas nem aceitam escopo vindo do cliente.

## Critérios de acessibilidade

Cada estado possui um título identificável, descrição textual, `aria-busy` durante carregamento e ações navegáveis por teclado. O fallback global preserva contraste e foco nativo sem depender de estilos da aplicação.

## Critérios de validação

- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`

## Próximas fatias

O inventário completo de queries legadas continua sendo uma frente separada. Toda nova feature deve usar contexto de tenant derivado da sessão, validação de entrada no servidor, auditoria para dados sensíveis e os componentes compartilhados definidos em `docs/standards/`.
