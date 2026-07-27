# Padrões de segurança, privacidade e multi-tenant

## Modelo de ameaça mínimo

Considerar como ameaças: usuário autenticado em outro tenant, usuário do mesmo tenant com papel inferior, link compartilhado vazado, replay de webhook, upload malicioso, segredo exposto em bundle/log, enumeração de IDs, abuso de endpoint, exportação excessiva e falha de job.

## Identidade e sessão

- A sessão é a única fonte de identidade no servidor.
- Papel, tenant, unidade e permissões são reconsultados ou derivados de contexto confiável; nunca aceitar esses campos do body, query string ou header do cliente como autorização.
- Renovar, invalidar e auditar sessões sensíveis; revogar sessões ao desativar usuário, trocar credencial crítica ou detectar risco.
- 2FA/passkey é opt-in apenas quando o domínio permitir; nunca contornar uma exigência já habilitada.
- Mensagens de login e recuperação não confirmam se uma conta existe.
- Cookies de sessão: `HttpOnly`, `Secure` em produção, `SameSite` adequado, escopo mínimo e expiração definida.

## Multi-tenant e autorização

Toda query deve começar com escopo do contexto. O padrão esperado é:

```ts
where(and(eq(table.tenantId, context.tenantId), ...resourcePolicy))
```

- Ausência de `tenantId` é erro, nunca acesso global implícito.
- Leads, documentos, clientes, cotações, vendas, tarefas e notificações exigem também escopo de unidade/responsável quando o papel determinar.
- Controle de objeto é obrigatório em cada mutation: não basta esconder botão.
- Rotas de super-admin ficam isoladas do dashboard de tenant e exigem papel explícito.
- IDs públicos são não enumeráveis e ainda precisam de autorização; UUID não substitui policy.
- Links compartilhados usam token aleatório, escopo mínimo, expiração/revogação e não expõem dados além do necessário.

## Entrada e saída

- Validar body, params, search params, headers e arquivos no servidor com Zod ou contrato equivalente.
- Limitar tamanho, quantidade, profundidade e frequência de cada entrada.
- Normalizar telefone, e-mail, IDs e datas antes de persistir.
- Escapar texto na saída e nunca renderizar HTML arbitrário sem sanitização comprovada.
- Erro para usuário: mensagem acionável; log interno: contexto seguro; nunca retornar stack, SQL, token ou PII desnecessária.
- Rate limit por usuário/tenant/IP nas superfícies públicas e integrações.

## Documentos e PII

- Storage privado por padrão; nenhum bucket público para documentos de cliente.
- A aplicação gera URL temporária após autorização; o cliente nunca escolhe bucket, owner ou chave final.
- Validar MIME real, extensão, tamanho, quantidade, nome e conteúdo quando aplicável; rejeitar executáveis e arquivos ambíguos.
- Preferir chave aleatória sem nome/CPF no caminho.
- Malware scanning e quarentena são requisitos para produção quando o provedor permitir.
- Registrar upload, leitura, download, aprovação, rejeição e exclusão lógica com actor, tenant, recurso, resultado e timestamp.
- Minimizar PII em logs, analytics, notificações e previews; mascarar telefone/e-mail quando o papel não precisar do valor completo.
- Definir retenção, exclusão e atendimento a solicitações LGPD antes de ativar novos campos sensíveis.

## Segredos e integrações

- Segredos somente em variáveis de ambiente/secret manager; nunca em `NEXT_PUBLIC_*`, código, migration, banco sem criptografia, URL ou log.
- Tokens externos cifrados em repouso, com rotação, escopo mínimo e identificação de versão.
- Integradores recebem somente os campos necessários e timeout, retry com backoff e circuit breaker quando apropriado.
- Webhooks: validar challenge/HMAC, janela anti-replay, idempotência, schema, origem e resposta rápida.
- Logs de integração registram status, duração, identificadores externos e erro sanitizado, nunca token ou payload completo por padrão.

## Auditoria

Auditar no servidor: login/logout e falhas relevantes, alteração de papel/permissão, acesso/exportação de PII, download de documento, transições críticas, exclusões, integrações, jobs administrativos e alterações do Super-admin.

Evento mínimo:

```text
actorId, actorRole, tenantId, branchId?, action, resourceType, resourceId,
result, reason?, requestId, createdAt, metadataMinimized
```

Auditoria deve ser append-only para o aplicativo, protegida por escopo e sem permitir que o usuário apague seu próprio rastro.

## Checklist de segurança antes de merge

- [ ] Entrada validada no servidor.
- [ ] Tenant e resource policy derivados do contexto.
- [ ] Mutações idempotentes quando reexecutáveis.
- [ ] Dados sensíveis minimizados e storage privado.
- [ ] Auditoria e `requestId` presentes.
- [ ] Erros não vazam segredo/PII.
- [ ] Rate limit/timeout/retry definidos para superfícies externas.
- [ ] Teste negativo cobre outro tenant e papel insuficiente.
