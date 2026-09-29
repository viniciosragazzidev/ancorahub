# Correção de roteamento WAHA para conversas internas

**Estado:** concluído localmente; validação integrada em VPS pendente

## Objetivo

Garantir que a conversa interna Diretor/Gestor–Corretor use exclusivamente o
número WAHA selecionado pelo tenant, sem fallback implícito, sem duplicar saídas
no histórico e com escopo de unidade aplicado ao Gestor.

## Alterações

- `WAHA_RELAY_URL` usa o contrato `/v1`; sem ela, `VPS_API_URL` usa diretamente
  o endpoint interno Fastify.
- `waha_direct` preserva o número selecionado. Pausa ou indisponibilidade mantém
  a outbox pendente e bloqueada com motivo seguro; retomar o número recoloca esses
  registros na fila.
- O envio do composer processa o registro recém-criado, não os itens antigos.
- Saídas internas existem apenas em `whatsapp_outbound_messages`; ecos WAHA de
  saída não são inseridos em `whatsapp_messages`.
- Webhook OpenWA exige sessão e assinatura, deriva o tenant da sessão encontrada
  e exige id do provedor para idempotência.
- A aba de corretores restringe Gestor à própria unidade e filtra os ledgers pelo
  conjunto autorizado de corretores.

## Riscos e rollback

O envio direto passa a expor corretamente uma sessão pausada como bloqueio em vez
de trocar silenciosamente de canal. Reverter os arquivos de código restaura o
comportamento anterior; não há migration ou alteração de dados.

## Evidências

- Testes unitários focados: 9 aprovados, incluindo a seleção Meta versus WAHA
  Direct.
- `npm run type-check`, lint, validação documental e `git diff --check`:
  aprovados.
- Compilação de produção do Next: aprovada. O `prebuild` padrão continua
  dependente de uma extensão ausente no checkout, por isso a compilação foi
  executada diretamente sem esse passo externo.
- O harness integral registrou diagnósticos arquiteturais, de segurança e de
  desempenho preexistentes; nenhum bloqueio novo foi atribuído a esta mudança.
- Pendente apenas o teste integrado VPS/WAHA com número selecionado, sessão
  pausada e webhook assinado.

## Atualização 2026-09-08 — isolamento da caixa principal

- Corrigida a montagem de `/conversas`: mensagens internas de corretores com
  `leadId = null` não podem mais virar cards sintéticos `Contato (...)` na fila
  geral de clientes.
- A classificação agora consulta os telefones de `broker_profiles` somente no
  tenant autenticado e reutiliza a normalização de telefone já usada no webhook.
- Mensagens sem lead de números realmente desconhecidos continuam elegíveis para
  a conversa sintética `whatsapp_unassigned`.
- Regressão coberta por teste específico de corretor, cliente desconhecido e
  mensagem já vinculada a lead.
- Verificação completa aprovada em
  `reports/agent/verification/2026-09-08T18-19-53.299Z.md`: documentação,
  arquitetura, segurança, desempenho, lint, TypeScript, 149 arquivos/671 testes
  e build de produção.
