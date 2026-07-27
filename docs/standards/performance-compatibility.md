# Desempenho, compatibilidade e resiliência

## Metas de referência

Medir em produção e em dados sintéticos; metas não substituem evidência.

| Área | Meta inicial |
|---|---|
| LCP | ≤ 2,5 s em página operacional comum |
| INP | ≤ 200 ms em interações prioritárias |
| CLS | ≤ 0,1 |
| API interna | p95 documentado por endpoint; erro e timeout visíveis |
| Webhook | responder challenge/evento em tempo curto e processar de forma idempotente |
| Jobs | reexecução segura, limite de lote e telemetria por execução |

## Next.js e React

- Server Components são padrão; use client apenas para estado, evento, browser API ou interação real.
- Fetch de banco ocorre no servidor; não enviar datasets inteiros para o browser quando a tela precisa de uma página.
- Usar loading.tsx, error.tsx, streaming e skeleton que preserve dimensões.
- Separar componentes client pesados; usar importação dinâmica quando o custo for comprovado.
- next/image com sizes, dimensões e prioridade apenas no conteúdo acima da dobra.
- Metadata e canonical por rota relevante.
- Não usar useEffect como substituto de busca server-side ou sincronização sem cleanup.

## Banco e queries

- Toda query aplica tenant, unidade e filtros autorizados antes de ordenar/paginar.
- Paginação por cursor para listas grandes; limite máximo de página sempre definido.
- Selecionar somente colunas necessárias; evitar N+1 e joins repetidos por item.
- Índices devem acompanhar filtros e ordenação reais; migrations incluem análise de impacto.
- Transações protegem invariantes; retry só em erro transitório conhecido.
- Cache deve ter chave com tenant, usuário quando necessário e filtros; invalidar após mutação.
- Consultas de dashboard agregam no banco e têm janela temporal explícita.

## Jobs, webhooks e integrações

- Cada job tem lock/idempotency key, timeout, retry limitado, backoff e dead-letter/registro de falha.
- Não assumir que Vercel Hobby executa cron a cada poucos minutos; capacidades dependentes de frequência ficam documentadas e monitoradas.
- Webhooks retornam rapidamente, deduplicam evento externo e deixam processamento pesado para job/queue apropriado.
- Timeout de rede, limite de payload e circuit breaker são obrigatórios em API externa.
- Nunca fazer retry cego de operações não idempotentes.

## Browser e dispositivos

Suportar as duas últimas versões estáveis de Chrome, Edge, Firefox e Safari desktop/mobile, além do Android Chrome suportado pelo cliente. Registrar exceções por capability.

- Progressive enhancement para clipboard, push, câmera, notificações e file APIs.
- Feature detection em vez de user-agent quando possível.
- Fallback textual para notificações, gráficos, drag-and-drop e animações.
- Testar redes lentas, aba em background, modo de economia de energia, toque e teclado.
- Não armazenar PII em localStorage; qualquer cache local tem expiração, escopo e limpeza.

## Observação e orçamento

- Cada rota crítica define orçamento de JS, consultas e imagens.
- Medir tamanho do bundle e regressão de Web Vitals em preview.
- Alertar p95/p99 de API, taxa de erro, filas atrasadas, falhas de distribuição, uploads e integrações externas.
- Desempenho ruim deve gerar hipótese, medição e correção; não otimizar por preferência.
