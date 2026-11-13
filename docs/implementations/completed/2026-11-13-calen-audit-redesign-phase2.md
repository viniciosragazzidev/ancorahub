# Auditoria do Calen e plano da fase 2 do Corretor

Data: 2026-11-13. Tipo: pesquisa de interface e planejamento documental.

## Estado

Pesquisa e plano entregues. **Nenhuma implementação de UI ou publicação realizada.** A fase 2 permanece proposta; UX-M1.10 continua com QA pendente.

## Escopo entregue

- LP, preços, acesso mobile, imagem pública do produto e sete etapas do tutorial inspecionados pelo navegador integrado.
- Inventário de cores, fontes, espaço, raios, botões, organização, aprendizagem, movimento observado e limites de cobertura.
- Comparação com componentes, tokens, navegação e home do Corretor Lite; complemento do kit ERP presente no worktree dedicado.
- Dezesseis lacunas/candidatos classificados entre evidência de código e hipóteses de usabilidade.
- Plano por ondas, rotas, componentes, estados, critérios de aceite, controle do Super-admin e rollback.
- Evidências selecionadas mantidas no repositório; capturas transitórias e de provedor de autenticação externo excluídas do conjunto do relatório.

## Arquivos

- [Auditoria](../../ux/phase2/2026-11-13-calen-design-audit.md).
- [Plano](../../ux/phase2/2026-11-13-corretor-redesign-plan.md).
- [Evidências](../../ux/phase2/evidence/calen-2026-11-13/).
- Índice `docs/ux/README.md` com links para ambos.

## Baselines e preservação

Principal: `46892e7c5200394dcd08c6108ee3a095c4d45b3b`, com mudanças locais anteriores preservadas. ERP: `148d98188f88d338664e028d899255a5b4dc59f5`, em `ancorahub-erp`. Não foram mescladas branches nem alterados componentes, permissões, dependências, banco ou configuração de produção.

## Validações

- Inspeção visual das evidências selecionadas e navegação confirmada pelas etapas do tutorial até sua saída.
- Verificação UTF-8 e existência de 25 links locais nos dois documentos e neste registro: passou. Quinze evidências selecionadas possuem tamanho e SHA-256 em `manifest.json`.
- `agent:context`: executado para o escopo documental.
- Fast: documentação e typecheck passaram; suíte global interrompida, sem conclusão de todos os testes. Relatório: `reports/agent/verification/2026-11-13T15-27-13.750Z.md`.
- Full: documentação, escopo, arquitetura, segurança, desempenho e typecheck passaram nos limites do harness. Lint falhou por ocorrências de codificação em arquivos não editados nesta tarefa, incluindo `docs/business-rules.md`, `monthly-duty-actions.ts` e testes existentes. A suíte global registrou falhas em testes de navegação, rotas e snapshots de aplicação; foi interrompida antes de terminar, pois a entrega altera somente documentos e evidências. Não há total final de testes nem declaração de aprovação global. Relatório: `reports/agent/verification/2026-11-13T15-29-27.564Z.md`.
- Logs completos: `reports/agent/verification/2026-11-13-calen-fast.log` e `2026-11-13-calen-full.log`. Verificação documental dirigida: `reports/agent/verification/2026-11-13-calen-documentation.md`.
- Build não foi alcançado pelo full após a suíte de testes. Nenhum código de aplicação foi alterado; o registro não certifica prontidão de uma implementação da fase 2.

## Limites e próxima ação

Não foram testados todos os fluxos privados do Calen, a precisão de seu assistente ou estados de formulário/erro. A sessão disponibilizada foi usada para observar o tutorial; nenhuma conexão bancária ou operação financeira foi iniciada.

A comparação do nosso sistema é por código e documentação. O próximo lote é R2-00: baseline autenticado, reconciliação do contrato semântico de ações e registro do piloto do corretor no controle vigente. Não há aprovação implícita de troca de marca, fonte, tema ou regra de negócio.

## Reversão

Esta entrega é documental. Os documentos não ativam capacidades e não alteram o gate. Uma implementação futura exige renderer anterior preservado e controle reversível auditado, conforme o plano.
