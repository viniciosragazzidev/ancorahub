# Testes, observabilidade e resposta operacional

## Pirâmide de testes

### Unitários

Cobrir policies, normalizadores, transições de status, SLA, round-robin, idempotência, checklist, conversão, cotações e comissões. Testar resultado e efeitos de auditoria; não depender de banco ou relógio real sem controle.

### Integração

Validar Drizzle, migrations, transaction boundaries, storage, adapters externos e escopo de tenant. Usar banco/credenciais sintéticos isolados.

### E2E

Manter poucos fluxos de alto valor: login/permissão, lead recebido e distribuído, atendimento/status, documentos por beneficiário, venda válida, notificação, webhook e recuperação de job.

### Acessibilidade e visual

Executar teclado/reader manualmente nos fluxos principais; verificar light/dark, viewport móvel, zoom e reduced motion. Não substituir teste de comportamento por snapshot.

## Dados de teste

- Nunca usar PII real em fixtures, screenshots, vídeos ou logs.
- Factories produzem tenant, unidade, usuários e relacionamentos consistentes.
- Cada cenário declara o papel e o escopo que devem ser visíveis.
- Testes negativos cobrem outro tenant, unidade incorreta, papel insuficiente, token expirado e recurso inexistente.

## Observabilidade

Toda operação crítica deve ter:

- request/correlation ID;
- duração e resultado;
- tenant/unidade/ator minimizados;
- código de erro estável;
- retryable ou não;
- vínculo com auditoria quando há mutação ou dado sensível.

### Métricas mínimas

Leads: recebidos, deduplicados, distribuídos, expirados, reprocessados e falhos.  
Atendimento: tempo até primeiro contato, transições rejeitadas, documentos pendentes/rejeitados, cotações e conversões.  
Infraestrutura: latência p50/p95/p99, erros por rota, DB pool, timeout externo, jobs atrasados e storage failures.

### Logs

- JSON estruturado em produção.
- Mensagem curta e código pesquisável.
- Sem token, senha, cookie, documento, telefone/e-mail completo ou payload externo completo.
- Stack trace apenas em destino protegido; mensagem pública sanitizada.
- Retenção alinhada ao mínimo necessário e à LGPD.

## Alertas e resposta

Alertar somente quando houver ação: aumento de 5xx, falha de webhook, fila de distribuição atrasada, documento indisponível, erro de migration, ausência de cron ou degradação persistente.

Cada alerta tem owner, severidade, link para runbook, limiar, silêncio controlado e teste periódico.

## Definition of Done de qualidade

- [ ] Teste unitário do contrato crítico.
- [ ] Teste negativo de isolamento e autorização.
- [ ] Integração/migration validada quando houver persistência.
- [ ] E2E atualizado se o fluxo ponta a ponta mudou.
- [ ] Logs e métricas sem PII indevida.
- [ ] Runbook ou decisão atualizada para falhas novas.
- [ ] Type-check, lint, testes e build executados.
