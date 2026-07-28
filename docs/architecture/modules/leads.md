# Módulo Leads

Responsável por entrada, consulta, carteira, funil, qualificação, timeline, tarefas e conversão. O servidor deriva tenant e escopo da sessão; a transição do funil é validada por estado anterior e o status `converted` ocorre apenas pelo fluxo de venda.

Consulte `docs/business-rules.md` (BR-020 a BR-028 e BR-036 a BR-039), ADR-001 e `src/features/leads`. Mudanças devem testar sucesso, transição inválida e acesso de outro tenant/carteira.
