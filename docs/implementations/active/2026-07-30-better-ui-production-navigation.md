# Refinamento Better UI e estabilidade de navegação

## Objetivo

Refinar as primitives compartilhadas para que todas as rotas herdem superfícies,
densidade e feedback de interação consistentes. Remover o wrapper global de
View Transitions para impedir cancelamentos de requisições RSC que deixavam o
loading de rotas autenticadas ativo indefinidamente em produção.

Aceite: controles e tabelas usam propriedades de transição explícitas, o modo
de movimento reduzido continua respeitado e navegações não dependem da API
experimental de View Transitions.

## Escopo e arquivos

- `src/components/ui/`: Button, Card, Badge, Input, Toggle, Tabs, Progress,
  Table, DataTable e Sidebar.
- `src/components/dashboard/`: métricas e MiniDonut.
- `src/components/notification-popover.tsx` e atalho de próximo lead.
- `src/components/motion/route-view-transition.tsx`: fallback seguro para
  navegação direta.
- `src/features/roadmap/roadmap-data.ts`: registro N38/N40.

## Decisões

- Nenhuma decisão de produto nova. `DESIGN.md`, `docs/ui-foundation.md` e a
  skill Better UI orientaram a troca de `transition-all` por propriedades
  explícitas e a remoção de motion decorativo em leitura operacional.
- O controle já existente de motion do Super-admin é preservado; apenas a
  transição experimental de rota deixa de ser usada até que seja estável em
  streaming de App Router.

## Validações

- `npm run agent:verify -- --level fast`: aprovado; documentação, type-check
  e 222 testes passaram. Evidência em
  `reports/agent/verification/2026-07-30T13-20-40.076Z.md`.
- `npm run type-check`: aprovado após a correção de navegação.
- `npm run build`: o output Next.js foi gerado localmente; o processo do
  harness excedeu o limite do terminal após a geração. A publicação Vercel
  deve ser a validação final de build.
- `npm run agent:verify -- --level full`: excedeu o limite do terminal na
  varredura, com `EPIPE`; não foi considerado aprovado.

## Riscos e rollback

Não há migration nem mutação de dados. O rollback é reverter este commit ou
reativar o wrapper de View Transitions quando o comportamento for validado em
produção.
