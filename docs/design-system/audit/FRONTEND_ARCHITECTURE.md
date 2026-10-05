# Frontend Architecture

## Applications
- Next.js CRM em `src/app`; extensão de navegador em `apps/browser-extension` fica fora do inventário desta etapa.

## Framework
- Next.js 16.2.10, React 19.2.4 e TypeScript.

## Routing
- App Router, route groups e segmentos dinâmicos em `src/app`.

## Styling strategy
- Tailwind CSS v4, `src/app/globals.css`, CSS variables e utilitários; há valores arbitrários catalogados.

## UI libraries
- shadcn/base-nova, Base UI, Radix Scroll Area, CVA, Sonner e Unlumen registry.

## Shared component directories
- `src/components/ui`, `src/components/unlumen-ui`, `src/components`.

## Feature component directories
- `src/features/**` e co-localizados sob `src/app/**`.

## Global styles
- `src/app/globals.css` contém tema, tokens atuais, motion e classes legadas.

## Theme system
- CSS variables + `next-themes`; contrato de dark theme continua DG-004.

## Icon system
- Hugeicons (configurado), Lucide, Phosphor e SVG/emoji precisam de consolidação.

## Form system
- React Hook Form/Zod devem ser confirmados por uso; primitives estão fragmentados (DG-010).

## Table system
- `@tanstack/react-table` está instalado; HTML/custom tables coexistem e DataTable canônico é DG-009.

## Chart system
- Recharts.

## Known legacy layers
- Global CSS extenso, primitives co-localizados e valores Tailwind arbitrários; não foram alterados.
