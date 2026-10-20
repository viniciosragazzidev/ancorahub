# Etapas dos leads para a Meta (API de Conversões para CRM)

## Objetivo

Mandar de volta para a Meta em que etapa cada lead de formulário (Lead Ads)
chegou, para a Meta otimizar as campanhas por "leads de conversão" (leads que
viram venda) e não só por volume. Decidido pelo diretor em 2026-10-20.

## Decisões

- **Etapas** (nomes fixos, não renomear depois de enviar): `Lead recebido`
  (lead criado pelo Lead Ads), `Qualificado` (qualificação vira morno ou
  quente), `Quente` (qualificação vira quente), `Venda` (venda registrada ou
  lead convertido). Cada etapa no máximo uma vez por lead.
- **Fase 1 só Lead Ads.** Clique para WhatsApp (CTWA) fica para a fase 2.
- **Fonte de dados (dataset)** escolhida na tela, entre as sincronizadas.
- **Token:** primeiro o token da conexão de Marketing atual. Se a Meta recusar
  (erro 190/200/10 aparece como "Último erro" na tela), trocar por token de
  usuário do sistema com `ads_management`.
- **Ao ligar**, envia também os leads de Lead Ads dos últimos 7 dias (a Meta não
  aceita eventos mais velhos que isso).
- Começa **desligado** para toda empresa. Só o diretor vê e altera.

## O que foi feito

- Tabelas `meta_conversion_settings` (liga/desliga, dataset, código de teste) e
  `meta_conversion_events` (fila de saída, uma linha por lead e etapa).
- `src/features/meta-ads/meta-conversion-events.ts`: regras puras (nomes das
  etapas, telefone com 55 e e-mail em minúsculas com SHA-256, `event_time`
  sempre depois da criação do lead e nunca no futuro, descarte depois de 7 dias,
  `lead_id` enviado como número int64 exato).
- `src/features/meta-ads/meta-conversion-service.ts`: `enqueueMetaConversionEvent`
  (idempotente, nunca quebra o fluxo do lead), reconciliação/backfill, envio
  (`runMetaConversionSender`), painel e configuração.
- Pontos de registro: webhook do Lead Ads (`meta-lead-ads.ts`), qualificação
  (`qualification-engine/service.ts`, `ai-agent/qualification-timeout-sweep.ts`,
  `capability-execution-engine.ts`, `trigger-execution-engine.ts`) e venda
  (`post-sale/actions.ts`, `proposals/actions.ts`). A cada rodada o job também
  reconcilia os leads dos últimos 7 dias, cobrindo qualquer caminho sem gancho.
- Job `GET /api/internal/jobs/meta-conversions` (Coolify, `*/5 * * * *`, ver
  `docs/runbooks/coolify-scheduled-tasks.md`): até 100 eventos por rodada,
  agrupados por empresa, até 8 tentativas com espera crescente; limite da Meta
  (códigos 4/17/32/613/80000+) deixa pendente e para a rodada.
- Tela Integrações › Meta: card "Enviar etapas dos leads para a Meta"
  (liga/desliga, dataset, código de teste, contagem de pendentes, enviados,
  recusados e o último erro). Só diretor.

## Como testar

1. Aplicar o SQL abaixo e criar a tarefa do Coolify.
2. No Gerenciador de Eventos, abrir o dataset > Testar eventos e copiar o código.
3. No CRM, Integrações › Meta: escolher o dataset, colar o código, ligar e salvar.
4. Criar um lead pela Ferramenta de Teste de Lead Ads (ou esperar um real), rodar
   o job e conferir "Lead recebido" em Testar eventos. Qualificar e registrar
   venda para ver as outras etapas.
5. **Apagar o código de teste** depois: com ele, os eventos não contam para
   otimização (e os já enviados em teste não são reenviados).

## SQL para aplicar ANTES do deploy

Arquivo `drizzle/0208_meta_conversion_events.sql` (cria só tabelas novas, sem
mexer em tabela existente). Sem ele, o card mostra "Recurso ainda não liberado",
o job responde erro 500 e o registro das etapas é ignorado com um aviso no log
(o lead entra, qualifica e vende normalmente).

## Próximos passos

- Fase 2: CTWA pelo dataset de mensagens (`action_source: business_messaging`,
  `messaging_channel: whatsapp`, `ctwa_clid` do referral).
- Nas campanhas de Lead Ads, trocar a meta de desempenho para "Maximizar leads
  de conversão" depois que a Meta mostrar a integração como ativa.
- Se a Meta recusar o token da conexão, cadastrar token de usuário do sistema.
