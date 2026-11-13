# Fundação do ERP operacional

Estado: plano concluído; fundação local implementada, com validação global limitada. ERP funcional ainda planejado. Data: 2026-11-12. Branch: `codex/erp-foundation`; base: `eb5e2938`.

## Solicitação e decisões confirmadas

- Pausar desenvolvimento do cotador interno e priorizar expansão para ERP a partir da LP `https://newmasterbi.com/`.
- ERP operacional primeiro; fiscal/folha/notas posteriores.
- Separar implantação, pagamento de mensalidade e comissão recebida; regra da segunda parcela não adotada.
- Preparar rotas e acessos mantendo regras financeiras pendentes.

## Entrega deste lote

- Comparação integral das 17 famílias de promessas da LP com código e documentação atuais.
- Plano de 15 pacotes funcionais, sequência M0 a M8, responsáveis, dados, estados, automações, governança e critérios de aceite.
- Matriz de perfis e reserva de rotas. Reservas não são páginas operacionais nem concessões a pessoas.
- Integração técnica de 22 reservas ao resolvedor de rotas por caminho e por chave, negadas para todos os papéis e fora do editor de cargos. O fallback do serviço de acesso também respeita a reserva.
- BR-100 e DEC-183; vocabulário dos fatos confirmados em `CONTEXT.md` e domínio ERP no manifest de contexto.

Código: `src/features/erp/route-reservations.ts`, seu teste e `src/features/custom-roles/{routes,effective-access,service}.ts`. Nenhum componente, token, animação, página, job ou consulta ao banco novo.

Documentos: `docs/product/erp-operacional/README.md`, `acessos-e-rotas.md`, `plano-de-implementacao.md`.

## Fora do lote

Páginas dos módulos novos, migrações financeiras, alteração de regras pendentes, novos acessos de Gestor, atribuição de cargos no banco, deploy e integrações externas. Nenhuma desativação do cotador publicado.

## Validação

- PASSOU: 22 testes em quatro arquivos, via `npm run test -- src/features/erp/route-reservations.test.ts src/features/custom-roles/effective-access.test.ts src/features/custom-roles/routes.test.ts src/features/custom-roles/presets.test.ts --maxWorkers=2`. Inclui quatro testes novos para reservas, concessão forjada, prefixos de relatórios, catálogo atribuível e preservação das rotas existentes. Log: `reports/agent/verification/erp-focused.log`.
- PASSOU: TypeScript no ciclo fast e no full; ESLint nos cinco arquivos TypeScript alterados; `git diff --check`.
- PASSOU: `agent:docs`, `agent:changed`, `agent:architecture`, `agent:security`, `agent:performance`; diagnósticos sem achados no escopo. Relatório full: `reports/agent/verification/2026-11-12T18-31-25.566Z.md`.
- FALHOU: lint global, por 987 ocorrências de mojibake já presentes em quatro arquivos. A alteração de BR-100 não corrige em massa o conteúdo anterior de `business-rules.md`.
- INCOMPLETO/FALHOU: suítes globais fast/full. A execução fast foi encerrada por pressão de memória; full foi repetido com afinidade de quatro CPUs e encerrado após registrar falhas fora do escopo, sem total final. O relatório automático registra `npm run test` como falha; não significa que todos os testes terminaram. Logs: `erp-fast.log` e `erp-full.log` na pasta de verificação.
- O teste existente de `action-areas` identifica quatro ações sem mapeamento: `src/app/dev/cotador/actions.ts`, `src/features/broker-unit-change/actions.ts`, `src/features/carteira/retorno-actions.ts` e `src/features/reports/plantao-report-actions.ts`. Esses arquivos, o catálogo e o teste não foram alterados neste lote; sem regra, o acesso por cargo continua negado. As demais falhas globais não foram diagnosticadas individualmente nem declaradas corrigidas.
- PASSOU: build separado `npm run build -- --webpack`: compilação concluída, TypeScript concluído, 138 páginas estáticas geradas e otimização final concluída. Avisos existentes de cache Webpack e `import.meta` em `unpdf`; nenhum erro de compilação. Log: `reports/agent/verification/erp-build.log`.
- Limite do build: usa dependências locais compartilhadas, com Next 16.2.10 instalado, enquanto o manifesto declara 16.4.5. Não houve instalação/atualização. O build local aprovado não substitui CI com o lockfile desta branch. Evidência consolidada: `reports/agent/verification/2026-11-12-erp-foundation.md`.

A análise da referência é documental/heurística: não houve acesso à conta interna do fornecedor nem teste do ERP novo. Snapshots regravados pelas suítes foram restaurados ao HEAD deste checkout, que estava limpo antes do trabalho. Nenhuma alteração preexistente do checkout principal foi restaurada.

## Riscos e rollback

O catálogo de reservas deve bloquear por prefixo mais específico, inclusive filhos de `/relatorios`, sem entrar na navegação/editor de cargos ou alterar as rotas existentes. Reverter os arquivos deste lote remove as reservas e preserva os dados atuais. Nenhuma operação no banco é necessária.

## Próximo marco

M0: cadastros/governança e importação com prévia, validação e aprovação. Os demais módulos continuam planejados. Não há deploy, associação de cargo a membro ou alteração de permissão de produção nesta entrega.
