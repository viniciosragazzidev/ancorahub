# Correção do contador de frios recuperados

Pedido aprovado em 2026-10-27: corrigir o zero indevido confirmado no card.
Domínio validado: manter a janela operacional e os critérios existentes de
tentativa, resposta real e auditoria de qualificação morna/quente.

## Causa e plano

O helper notStatusBroadcastSql já exclui Status. A negação adicional no EXISTS
invertia o filtro, descartando conversas reais e aceitando apenas Status.

1. Executar a consulta real com fixtures sintéticas em CTEs, somente SELECT,
   cobrindo respostas reais, Status, texto vazio, resposta anterior à tentativa,
   tentativas duplicadas, tenant e unidade.
2. Remover somente a negação adicional e validar a regressão.
3. Registrar as verificações e enviar a correção isolada para diretor-visual-lite.

Nenhuma regra nova, alteração visual, envio de mensagem, dependência ou migração.
Mantidos os controles e a auditoria existentes da faixa e da qualificação.

## Estado

Correção implementada e validada, pronta para envio à branch solicitada. Rollback:
reverter somente o commit desta correção. A publicação depende do deploy.

## Evidências

- A consulta real falhou nos três cenários sintéticos antes da correção e passou
  nos três após remover a negação. As fixtures cobrem diretor e duas unidades.
- Testes direcionados: 68 testes em 10 arquivos passaram, incluindo as fixtures
  SQL em transação somente leitura. ESLint dos três arquivos alterados passou.
- TypeScript passou nos níveis fast e full do harness. Documentação, arquitetura,
  segurança e desempenho também passaram no full.
- O lint geral encontrou 952 ocorrências preexistentes de mojibake. A suíte geral
  encontrou falhas em meta-capture-controls e depois falta de espaço no disco;
  foi interrompida e não é declarada aprovada.
- O primeiro build falhou por ENOSPC. Foram liberados cerca de 3,8 GB de arquivos
  específicos do cache gerado neste worktree. A repetição passou com cache
  desativado e TypeScript já validado separadamente. A configuração temporária
  foi restaurada integralmente; não integra o commit. Aviso existente do unpdf.
- Relatórios: `reports/agent/verification/2026-10-27-cold-recovery-card-check.json`,
  `reports/agent/verification/2026-10-27T20-58-35.350Z.md` e
  `reports/agent/verification/2026-10-27T21-03-12.733Z.md`.
