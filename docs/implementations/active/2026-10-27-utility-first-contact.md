# Correção isolada: Utility no atendimento e requalificação

Pedido aprovado em 2026-10-27: usar a opção válida de menor custo e enviar apenas
esta correção. O vínculo antigo FIRST_CONTACT não pode promover o envio para
Marketing. A autorização e o domínio já foram definidos nesta conversa.

## Plano validado

1. Exigir categoria Utility efetivamente aprovada na WABA ativa para os templates
   de qualificação, inclusive nomes explícitos; preservar mensagem livre elegível.
2. Reutilizar o primeiro contato Utility existente quando a configuração antiga
   apontar para Marketing e o lembrete Utility nos reenvios de requalificação.
3. Impedir fallback estático quando faltar Utility; excluir Marketing da seleção
   automática da cadência, sem alterar conteúdo/categoria de templates existentes.
4. Testar seleção real do serviço, executar verificações e publicar commit isolado.

Mantidos: escopo de tenant/WABA, opt-out, frequência, destinatários, controles
administrativos, outbox e auditoria existentes. Nenhum reenvio aos contatos reais.

## Estado

Implementado e validado; publicação do commit isolado autorizada pelo usuário.
Sem alteração manual de dados de produção, reenvio a contatos ou dependências.
O deploy continua sob responsabilidade do Vinicios.

## Validações

- Regressão reproduzida antes da correção: cinco falhas na seleção real do serviço.
- 66 testes focados passaram, incluindo 13 testes da correção e do bloqueio antes
  de gravar a outbox quando não existe Utility elegível.
- Lint dirigido passou sem erros; três avisos preexistentes de imports não usados.
- TypeScript passou no harness e novamente no build.
- Build de produção passou: npm run build -- --webpack. Aviso preexistente de
  import.meta em unpdf; dependências locais reutilizadas por junction.
- Preflight somente leitura confirmou anc_t0_assistente e anc_t1_lembrete como
  Utility aprovados na WABA ativa. Nenhuma mensagem enviada para validar.
- Harness full: documentação, arquivos alterados, arquitetura, segurança,
  desempenho e TypeScript passaram. Lint global falhou por 952 ocorrências de
  codificação preexistentes. Rodada geral encerrada depois de falhas em 22
  arquivos fora do escopo; não representa a execução completa dos 645 arquivos.
  A falha de sales-navigation.test.ts foi reproduzida isoladamente, com teste e
  sidebar iguais à base. Nenhum snapshot de interface integra esta entrega.
- Evidências locais: reports/agent/verification/2026-10-27T13-50-12.472Z.md e
  reports/agent/verification/2026-10-27-utility-resource-preflight.json.

## Rollback

Reverter somente este commit. Qualificação, requalificação e cadência continuam
sujeitas aos controles administrativos e de Super-admin existentes.
