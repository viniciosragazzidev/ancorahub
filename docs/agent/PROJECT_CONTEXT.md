# Contexto do Projeto

CorreTop é um CRM multi-tenant para corretoras de saúde. O núcleo opera leads,
distribuição, atendimento, cotação, documentos, venda, pós-venda e comunicação oficial
por WhatsApp. A fonte de verdade de identidade, tenant, unidade e permissão é sempre o
servidor; browser, webhook e extensão nunca são autoridades de escopo.

Arquitetura: Next.js App Router + TypeScript estrito, Drizzle/Postgres, Better Auth,
Zod e domínios em `src/features`. Páginas e componentes são hosts; regras e consultas
críticas devem viver em serviços/use cases/repositories escopados. O catálogo Plugin
First é a direção incremental de modularização.

Prioridades permanentes: isolamento de tenant, LGPD, auditoria, idempotência de canais,
estados reversíveis governados pelo Super-admin, rastreabilidade de decisões e fluxo
operacional claro para Diretor, Gestor e Corretor.

Consulte `CONTEXT.md` para o vocabulário de domínio e `docs/business-rules.md` para
invariantes verificáveis. Não use este arquivo como especificação de fluxo.
