# Pesquisa — navegação rápida no Next.js 16 em VPS

**Data:** 2026-08-26  
**Escopo:** App Router do Next.js 16.2.10 no CRM, hospedado em um único container Node.js via Coolify.  
**Fontes:** exclusivamente documentação oficial do Next.js e a instalação local da versão usada pelo projeto.

## Diagnóstico que orienta o plano

As telas observadas ficam no `loading.tsx` por tempo perceptível. Em um App Router dinâmico, o comportamento padrão de prefetch só traz a árvore até a fronteira de `loading`; o clique ainda precisa buscar e renderizar o payload RSC da página. Assim, o skeleton não é evidência de lentidão do React no navegador: ele é o sintoma de espera pelo servidor, banco ou ambos. [Next.js — Prefetching](https://nextjs.org/docs/app/guides/prefetching)

No CRM, a primeira prioridade é reduzir o trabalho request-time e a fila do banco antes de mascarar a demora com cache. Nenhum cache de lista de leads, permissões, conversas ou PII pode ser compartilhado entre tenants ou usuários sem uma chave de escopo e uma política explícita de invalidação.

## Referências oficiais e decisões práticas

| Tema | Fato oficial | Decisão para o CRM |
|---|---|---|
| Prefetch e Router Cache | `Link` no viewport faz prefetch em produção. Para rota dinâmica com `loading.tsx`, o padrão é parcial; `prefetch={true}` busca a rota completa e o cliente mantém payloads RSC por segmentos. [Link](https://nextjs.org/docs/app/api-reference/components/link) · [Prefetching](https://nextjs.org/docs/app/guides/prefetching) | Aplicar prefetch completo somente aos destinos recorrentes da navegação lateral (`/dashboard`, `/leads`, `/conversas`, `/clientes`) e prefetch por intenção para links de listas. Não fazer prefetch em massa de centenas de leads. Invalidar/refazer o prefetch após mutações relevantes. |
| Atualizações do router | `router.refresh()` refaz a requisição, re-renderiza Server Components e limpa a cache do cliente da rota atual. [useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router) | Auditar todos os listeners de realtime, polling e Server Actions: coalescer eventos, nunca disparar refresh concorrente e preferir atualização local/otimista quando a mutação já conhece o resultado. |
| Streaming | `Suspense` próximo do dado dinâmico permite que seções independentes renderizem em paralelo; em self-hosting, o proxy deve entregar chunks sem buffering. [Cache Components](https://nextjs.org/docs/app/getting-started/partial-prerendering) · [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) | Substituir o único `loading.tsx` de tela por limites internos: shell e toolbar imediatos; tabela, contadores e filtros lentos resolvem em limites separados. Medir TTFB e tempo do primeiro conteúdo útil. Configurar proxy/Coolify para não bufferizar streaming antes de adotar PPR. |
| Cache Components / PPR | `cacheComponents: true` é opt-in no Next 16. `use cache` permite cachear função/componente e PPR entrega um shell estático com partes dinâmicas por streaming. Dados que dependem de `cookies`, `headers`, `params` ou `searchParams` não podem estar diretamente em `use cache`; devem ficar em `Suspense` ou receber valores seguros como argumento. [Cache Components](https://nextjs.org/docs/app/getting-started/partial-prerendering) · [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache) | Fazer um piloto em rota de baixo risco. Cachear somente catálogos/configurações sem PII e com chave explícita de tenant, `cacheLife` curto e invalidação por tag. Não habilitar globalmente antes de remover `force-dynamic` legado, decompor limites de Suspense e validar isolamento. |
| Cache self-hosted | Em uma instância persistente, o cache padrão de Next funciona no disco local. Em várias instâncias, o cache em memória é isolado; cache handler compartilhado é o caminho oficial quando houver escala horizontal. [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) · [cacheHandlers](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) | Enquanto houver um container, preservar o cache local entre deploys quando viável. Ao criar réplicas, usar Redis já existente para `use cache: remote`/cache handler e coordenar invalidações por tag antes de balancear tráfego. |
| Assets, proxy e compressão | Next já define cache imutável de um ano para `/_next/static`. `next start` usa gzip por padrão; se o proxy fizer Brotli/gzip, desabilitar a compressão duplicada no Node. O guia recomenda reverse proxy antes do Node. [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) · [compress](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress) | Manter proxy gerenciado pelo Coolify, confirmar `Content-Encoding` e cache dos assets. Não cachear HTML/RSC autenticado no proxy/CDN. Se houver Cloudflare, cachear somente assets versionados e respostas explicitamente públicas. |
| Docker | `output: 'standalone'` gera um servidor mínimo e dependências rastreadas; `public` e `.next/static` precisam ser copiados para a saída standalone quando ela é usada. [output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) | O CRM já tem `output: 'standalone'`. Confirmar no Dockerfile que `public` e `.next/static` são copiados para a imagem final e que o processo é `node .next/standalone/server.js` ou um `next start` coerente com a imagem. |

## APIs experimentais: não usar como atalho de produção

`experimental.staleTimes` mantém segmentos no Router Cache, mas a própria documentação declara o recurso experimental e **não recomendado para produção**. Não deve ser a solução para as telas atuais. [staleTimes](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes)

O projeto usa 16.2.10. Nessa linha há o `export const unstable_instant`, exclusivo de Server Components e dependente de `cacheComponents`; ele valida amostras de navegação estática ou de runtime em desenvolvimento/build. É uma ferramenta experimental de **validação** de uma navegação instantânea, não um switch genérico de cache. A implementação seguinte 16.3 já a renomeia para `instant`, confirmando que o contrato está mudando. Portanto, não será base de produção do CRM; poderá ser usado apenas como diagnóstico, isolado em uma branch. [Documentação oficial 16.2.9](https://raw.githubusercontent.com/vercel/next.js/v16.2.9/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.mdx) · [Documentação oficial 16.3.3](https://raw.githubusercontent.com/vercel/next.js/v16.3.3/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.mdx)

## Plano de máxima performance, em ordem segura

### Fase 0 — medir antes de otimizar

1. Adicionar `Server-Timing` separado para autenticação/contexto, cada query principal e render da rota.
2. Registrar apenas metadados seguros: rota, tenant hash, status, duração, contagem e causa de refresh; jamais PII, token ou payload de conversa.
3. Medir no navegador: clique → primeira resposta visual, clique → tabela utilizável, TTFB do RSC, payload e quantidade de `router.refresh`.
4. Definir SLO inicial: shell em até 300 ms, conteúdo operacional em até 1 s no p95 da VPS; alertar acima de 2 s.

### Fase 1 — remover espera desnecessária (primeiro rollout)

1. Mapear e eliminar waterfalls entre layout, contexto, capabilities, preferências e queries de cada página. Iniciar operações independentes antes do primeiro `await` e limitar cada tela a uma consulta paginada/projetada.
2. Trocar qualquer reparo, distribuição, qualificação ou sincronização executada na leitura da página por fila/cron/outbox. A leitura nunca deve fazer escrita de manutenção.
3. Tratar `DB_POOL_MAX=1` como suspeita operacional: medir fila e conexões; aumentar gradualmente para 2 somente se o pooler do Supabase tiver capacidade comprovada. Isso ataca tanto carga da tela quanto concorrência de webhooks.
4. Coalescer realtime em uma única janela curta por rota e evitar `router.refresh()` quando a atualização local já resolveu a alteração.

### Fase 2 — navegação que parece instantânea

1. Garantir que toda navegação interna use `next/link`, não `<a>` nem `window.location`.
2. Para o menu lateral, usar `prefetch={true}` apenas nos quatro destinos operacionais prioritários. Fazer prefetch por hover/focus para links menos frequentes e cartões de lead; não para a tabela inteira.
3. Depois de mutação que altera lista ou detalhe, atualizar o store/query local e chamar somente a invalidação/prefetch da rota afetada. Não usar refresh global.
4. Manter um shell real e persistente no layout. O fallback de cada painel deve ocupar apenas a região ainda pendente, nunca cobrir toda a tela quando layout/navegação já estão prontos.

### Fase 3 — streaming real

1. Separar páginas em Server Components de leitura independente: cabeçalho/ações, KPIs, tabela, painéis secundários.
2. Usar um `Suspense` por unidade que tenha razão própria para esperar; iniciar as promises antes dos limites para remover waterfalls.
3. Validar, com `curl -N` e DevTools, que o primeiro chunk chega antes da query lenta. Se não chegar, corrigir a configuração de buffering do proxy do Coolify antes de mudar a UI.

### Fase 4 — Cache Components, com isolamento

1. Criar flag operacional desativada por padrão e testar primeiro uma rota sem PII.
2. Habilitar `cacheComponents` somente nessa branch de rollout. Remover flags antigas incompatíveis conforme o guia de migração. [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
3. Cachear configurações e catálogos pouco mutáveis com `use cache`, chave incluindo tenant quando aplicável, `cacheLife` explícito e `cacheTag`/invalidação acionada pela mutação.
4. Deixar sessão, permissões, leads, conversas, filas e dados de cliente em limites dinâmicos autenticados até existir contrato de cache auditado e teste de isolamento inter-tenant.

### Fase 5 — VPS e escala

1. Confirmar streaming end-to-end e compressão única no proxy; enviar `X-Accel-Buffering: no` apenas se o proxy adotado respeitar esse cabeçalho.
2. Confirmar artefato standalone completo, assets imutáveis disponíveis e healthcheck de liveness sem consulta ao banco.
3. Antes de adicionar uma segunda réplica: definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId`, cache remoto Redis e coordenação de tags, como prescrito pelo guia de self-hosting.
4. Para CDN, usar apenas assets versionados e páginas públicas/ISR. HTML/RSC autenticado deve permanecer `private, no-store`.

## Critérios de aceite por fase

- Não há tela inteira em skeleton por mais de 300 ms quando o destino foi prefetched; parte lenta mostra limite local, não bloqueia o shell.
- Uma interação produz no máximo um refresh coordenado da rota.
- Nenhuma rota autenticada retorna dados de outro tenant em cache, teste automatizado ou tráfego observado.
- `/_next/static` vem com `Cache-Control: public, max-age=31536000, immutable`; HTML/RSC autenticado continua privado.
- p95 e p99 de DB, RSC e navegação são acompanhados antes/depois de cada fase.
