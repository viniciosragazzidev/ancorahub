# Registrar venda v2

Data: 2026-11-12. Worktree `ancorahub-registrar-venda`, branch `feat/registrar-venda-v2`.

## Objetivo

Unificar o registro de venda no Lite, aceitar a conclusão de venda já detectada pela IA sem repetir conversão nem efeitos, criar o titular a partir do cadastro existente e administrar dependentes na ficha do lead. A venda continua bloqueada até existir confirmação da operadora anexada e aprovada.

## Plano por área

1. **Domínio e persistência:** extrair regras puras e testáveis para elegibilidade, idempotência, pré-preenchimento do titular e lacunas documentais. Usar o lead e seus beneficiários dentro do tenant. Reaproveitar o cliente ligado ao lead e completar corretor/unidade apenas quando estiverem vazios. Conversão prévia da IA não repete status, histórico de etapa, Meta sale nem push `lead_converted`; mantém somente o aviso curto da DEC-179.
2. **Beneficiários:** ao abrir o fluxo, garantir um titular com nome e contato do lead e dados explícitos já disponíveis em formulário/qualificação. A seção da ficha permite incluir, editar e remover dependentes, com parentesco, data de nascimento ou idade e CPF opcional. Se `livesCount` exceder o cadastro, indicar quantos beneficiários faltam.
3. **Wizard Lite:** quatro passos curtos, Pessoas, Plano, Documentos e Revisão, com progresso “Passo X de 4 · Nome”. Reutilizar componentes e tokens Lite/Arc, uma superfície no passo Pessoas e Arc DatePicker localizado no lugar de input nativo. Valores do rascunho permanecem ao avançar e voltar no fluxo; persistência após recarregar ou fechar fica **a confirmar**. Documentos mostra o estado e o botão de envio junto a cada pendência. A faixa de venda da IA aparece somente em Pessoas e os textos usam singular/plural correto.
4. **Rollout reversível:** a flag global auditada no Super-admin, desligada por padrão e com fallback para o painel legado, foi adotada pelo recomendado. A escolha operacional do piloto fica **a confirmar**; a venda existente continua disponível com a flag desligada.
5. **Prévia e qualidade:** rota dev com dados sintéticos para estados vazio, erro, documento pendente e venda detectada pela IA; capturas 390×844 e 1440×1000 por passo, incluindo o calendário aberto. Testes focados, typecheck, ESLint e build webpack. Nenhum teste deve acessar banco real.

## Banco

A tabela `lead_beneficiaries` atualmente obriga data de nascimento e não guarda idade avulsa ou CPF. Para cumprir o cadastro sem inventar datas, a migration `drizzle/0228_lead_beneficiaries_identity_fields.sql` torna `birth_date` opcional e adiciona `age` e `cpf` opcionais. O SQL é entregue como arquivo e nunca executado nesta tarefa.

## Decisões adotadas

- **Confirmação da operadora:** requisito continua anexado e aprovado em todos os registros, inclusive venda convertida pela IA. Decisão explícita de Vinicios em 2026-11-12; não altera regra de negócio.
- **Compatibilidade e rollout:** adotada a recomendação de flag global auditada no Super-admin, desligada por padrão, com fluxo legado preservado. A decisão operacional do piloto fica **a confirmar**.
- **Rascunho:** dados permanecem ao navegar entre os quatro passos; persistência após fechar/recarregar fica **a confirmar**.
- **Identidade:** formulário/qualificação preenchem data, idade e CPF somente quando o valor for explícito e válido. Para pessoas sem data, idade avulsa é suficiente; a ficha não inventa nascimento.

## Implementação

- `RegisterSaleWizard` é apresentado apenas no Corretor Lite com a flag ativa e para o lead do corretor. Leads convertidos pela IA com registro pendente entram no mesmo fluxo; leads perdidos, já registrados e vendas ativas continuam bloqueados.
- O passo Documentos lista requisitos pendentes/rejeitados, distingue aprovação pendente e aceita upload no próprio fluxo. A etapa do lead só avança para Documentação em leads ainda não convertidos; conversão da IA não é revertida.
- O titular é criado ou completado idempotentemente ao abrir o fluxo, dentro de transação e com auditoria. Nome/contato vêm do lead; atributos pessoais vêm apenas de formulário/qualificação. CPF completo só é entregue à direção.
- Beneficiários podem ser incluídos, editados e removidos na ficha. Quando a quantidade do cadastro ficar abaixo das vidas declaradas, o fluxo sugere quantas pessoas faltam sem criar dependentes automaticamente.
- O wizard usa barra compacta de progresso e passos Pessoas, Plano, Documentos e Revisão. O calendário de vigência usa Arc DatePicker em português; em telas até 640 px abre acima do campo para permanecer visível. O passo Pessoas tem uma única superfície para os beneficiários; a faixa da IA só aparece nesse passo. Cada requisito documental pendente tem ação Enviar/Corrigir que direciona o upload no próprio passo.
- Mensagens de quantidade usam singular e plural explícitos, sem “(s)”. A prévia não apresenta input nativo `date`.
- Registro de venda mantém o bloqueio por lead, unidade e tenant. Clientes existentes ligados ao lead são reutilizados; corretor e unidade só são preenchidos se estiverem vazios.
- A conversão prévia pela IA não dispara novamente histórico/etapa, evento Meta `sale` ou push `lead_converted`; mantém o aviso curto “Venda registrada no CRM” da DEC-179.

## Verificação desta entrega

- `npx tsc --noEmit --pretty false`: aprovado após o teste final.
- Vitest focado (`sale-registration-v2-core`, `register-sale-access`, catálogo de flags e wizard): 4 arquivos, 25 testes aprovados.
- ESLint focado no wizard, testes, Arc DatePicker/Calendar e regras puras: aprovado, sem avisos.
- `git diff --check`: aprovado. Sem `.env.local` nesta worktree; nenhum teste acessa o banco.
- Capturas sintéticas em `reports/agent/registrar-venda-v2/`: passos 1–4 em 390×844 e 1440×1000, calendário aberto nos dois tamanhos. Nenhuma captura reporta overflow horizontal. A prévia abre; chamadas globais de telemetria sem banco registram 503 no console, sem afetar a fixture.
- `npx next build --webpack`: aprovado. Compilação webpack em 7 min, TypeScript do build em 3 min e 139/139 páginas estáticas geradas. Avisos de `unpdf` ao acessar `import.meta` e uso dinâmico de `headers` em rotas existentes durante a coleta.
- O lint global já falhou nesta worktree no verificador de codificação por conteúdo preexistente fora do escopo: `docs/business-rules.md`, `src/features/lead-distribution/monthly-duty-actions.ts`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`. ESLint focado dos arquivos alterados passa sem avisos.

## Papéis, segurança e auditoria

Tenant, lead, corretor e unidade sempre vêm da sessão/consulta no servidor. Revalidar permissão, lead ativo e documento aprovado dentro da operação; mutações de beneficiários são escopadas e auditadas sem inserir CPF ou outros valores na auditoria. A trava do lead e a verificação da venda ativa permanecem no mesmo fluxo transacional.

## Estado

Implementação concluída. Regra de confirmação da operadora mantida por decisão de Vinicios em 2026-11-12, sem alteração de regra de negócio. Piloto e persistência do rascunho após fechar/recarregar permanecem **a confirmar**.
