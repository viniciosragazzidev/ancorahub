# Backfill seguro e evidência de venda

## Objetivo

Recuperar leads em fechamento para os quais a detecção de venda não rodou, manter evidências de pagamento validadas entre análises e permitir recuperar manualmente o aviso à direção.

## Escopo

- `scripts/backfill-sale-detection.ts` analisa leads ativos em `documentation_pending` ou `under_analysis`. A transcrição reúne as mensagens recentes e mensagens de pagamento, entrevista concluída, transmissão e contexto de comprovante nos últimos 30 dias. O padrão é dry-run; só `--apply` chama o caminho canônico da detecção.
- A IA usa o gateway sensível e só a lógica existente de `applyAiSaleDetection` pode converter. `changeLeadStatus` continua responsável por regra de transição, auditoria e timeline; o fluxo de notificação existente parabeniza o corretor e avisa a direção.
- A evidência de pagamento validada contra mensagens reais é guardada em `qualificationDetails.aiSaleEvidence` e reaparece na memória da próxima análise, mesmo fora da janela recente de mensagens.
- `interview` é prova forte quando cliente ou corretor relata entrevista médica/videochamada concluída. Pergunta, tentativa, futuro e negativa são rejeitados. `medical_interview_approved` também prova conclusão.
- Diretor e gestor da unidade podem recuperar em conjunto os parabéns ao corretor e o aviso à direção em lead de fechamento. A prévia mostra status e horário, cada destino mantém idempotência própria, só o que falta é enviado e a ação registra auditoria.

## Decisões

Registradas em DEC-172/DEC-173 e BR-093/BR-094. O backfill desta entrega deve ser executado somente sem `--apply`; nenhum lead será convertido por este trabalho.

## Próxima etapa aprovada

Implementar em commit separado o bloco “Dados da venda” na ficha, com extração de conversa, fontes indicadas, marcação “a confirmar”, escopo por papel, CPF mascarado conforme papel, atualização por mensagem e cópia do resumo. Pedido do Vinicios em 2026-11-10.

## Arquivos principais

- `src/features/conversation-intelligence/sale-detection-core.ts`
- `src/features/conversation-intelligence/context-builder.ts`
- `src/features/conversation-intelligence/analyzer.ts`
- `src/features/conversation-intelligence/sale-detection.ts`
- `src/features/leads/closing-director-alert.ts`
- `src/features/leads/closing-notices-recovery-action.ts`
- `src/features/leads/closing-notices-recovery-core.ts`
- `src/features/leads/components/send-closing-notices-recovery-button.tsx`
- `src/app/(dashboard)/leads/[id]/page.tsx`
- `scripts/backfill-sale-detection.ts`

## Validação

- `npx vitest run src/features/conversation-intelligence/sale-detection-core.test.ts src/features/conversation-intelligence/conversation-intelligence.test.ts src/features/leads/closing-stage-notice.test.ts src/features/leads/closing-notices-recovery-core.test.ts src/features/leads/closing-notices-recovery-action.test.ts src/features/leads/closing-director-alert-core.test.ts`: 6 arquivos, 93 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- ESLint focado nos arquivos alterados: 0 erros e 9 avisos `no-explicit-any` em trechos preexistentes da ficha e do analyzer.
- `npm run lint` para no verificador de codificação do repositório por problemas preexistentes de mojibake em arquivos fora do escopo. `agent:verify -- --level fast` também encontrou falhas fora do escopo e foi interrompido depois de iniciar a suíte global; os testes focados passaram independentemente.
- Backfill em dry-run somente leitura para Andrea (`a7cc8e11-08ad-497a-921a-28f6370bb02a`): `confirmed`, corretor Carlos Eduardo 10961, com Pix e entrevista como evidências. O banco mostra “Vou tentar agora a chamada” às 17:23 de 09/11 (tentativa corretamente excluída) e “Consegui fazer o videio chamanda” às 17:45 (prova aceita), embora o pedido inicial associasse a frase de conclusão às 17:23. O Pix consta em 04/11 às 08:36, horário de São Paulo. Nenhum `--apply` foi executado.

- A suíte focada inclui só direção pendente, só parabéns pendente, ambos pendentes, ambos registrados, seleção de apenas um telefone faltante e bloqueio do gestor fora da unidade.

## Risco e retorno

O classificador pode retornar resultado inconclusivo; evidência literal é validada novamente antes de qualquer conversão. O retorno consiste em reverter os commits desta implementação. O script nunca deve ser executado com `--apply` sem autorização explícita do Vinicios.
