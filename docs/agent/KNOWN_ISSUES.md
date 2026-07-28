# Problemas Conhecidos

| ID | Situação | Impacto | Próxima ação |
| --- | --- | --- | --- |
| ENG-001 | `npm run lint` possui 71 erros e 114 avisos no baseline de 28/07/2026, principalmente efeitos React com estado síncrono, `any` e imutabilidade. | CI já falha; risco de render em cascata em superfícies afetadas. | Corrigir por lotes de domínio antes de tornar lint um gate do harness. |
| ENG-002 | Há somente 3 boundaries `error.tsx` e 5 `loading.tsx` no App Router. | Erros e carregamento não são consistentes em toda a aplicação. | Definir cobertura por rota crítica e criar primitives compartilhadas. |
| ENG-003 | Alguns arquivos de domínio e workspace excedem 30 KB. | Aumenta custo de contexto e risco de acoplamento. | Extrair serviços e componentes quando receberem mudança funcional. |
| ENG-004 | A cobertura E2E atual cobre dois fluxos gerais; canais e extensão ainda dependem de homologação controlada. | Risco de regressão em integração externa. | Criar fixtures de provider e ambiente E2E isolado. |

Este arquivo registra fatos observados, não hipóteses. Remova uma linha apenas com PR ou registro de implementação que contenha validação de encerramento.
