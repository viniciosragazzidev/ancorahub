# T123: Aviso diário compacto do WhatsApp

Em 14/10/2026, o papel de corretor recebeu o aviso diário em uma composição
compacta: tile de 32px, título de 15px, ação de conexão em tamanho padrão e
fechamento. O parágrafo e a orientação de conexão ficam recolhidos por padrão e
podem ser revelados por “Por quê?”. No celular, o CTA continua oculto e a
orientação curta aparece ao expandir os detalhes. O aviso sticky do Jack e as
regras de exibição, auditoria, armazenamento e conexão permanecem inalterados.

Arquivos afetados:

- `src/components/whatsapp/whatsapp-plantao-notice.tsx`
- `src/components/whatsapp/whatsapp-plantao-notice.module.css`
- `src/components/whatsapp/whatsapp-plantao-notice.test.tsx`
- `src/features/roadmap/roadmap-data.ts`

Validações:

- `npx vitest run src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: 4 testes aprovados.
- `npm run type-check`: aprovado.
- `npx eslint src/components/whatsapp/whatsapp-plantao-notice.tsx src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: aprovado.
- `npm run build`: bloqueado pelo Turbopack, que rejeitou o junction de `node_modules` apontando para fora da raiz do worktree. `npx next build --webpack` permaneceu sem progresso por mais de dois minutos e foi interrompido.

Sem alteração de domínio, decisões, tokens, componentes base ou dependências. Nenhum
teste de banco foi executado.
