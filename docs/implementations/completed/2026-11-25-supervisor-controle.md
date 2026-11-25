# Controle operacional do Supervisor Lite

## Pedido e objetivo

Pedido direto de Vinicios em 25/11. A supervisora precisa ver a operacao atual da equipe, somente pendencias acionaveis com motivo claro e observacoes completas dos corretores. Prazo confirmado para lead de lista importada: 24 h desde a distribuicao, reutilizando `imported-first-contact.ts`.

## Diagnostico de ruido

1. `supervisor-workspace/queries.ts` exclui todos os leads `supervisor_import` das contagens, enquanto as regras de pendencia do corretor nao eram expostas ao supervisor.
2. A lista antiga de atencao usava estado/idade de leads quentes sem avaliar oferta aberta, dono atual e prazo de primeiro contato no mesmo ponto.
3. A tela de equipe mostrava contagens gerais, mas `acceptedToday` ficava sempre em zero.
4. Tarefas futuras nao devem ser atraso; o novo recorte exige `dueAt < agora`, tarefa aberta e texto de retorno/follow-up.
5. Lead ja contatado nao deve gerar cobranca: o recorte confere `firstContactAt` e mensagens validas, ignorando falhas, historias do WhatsApp e eventos sem conteudo.

## Escopo e decisao de produto

- Rota `/equipe/controle`: resumo por corretor, disponibilidade existente, escala ativa/presenca, leads em atendimento, aceites e primeiros contatos de hoje; ofertas sem aceite apos cinco minutos, primeiro contato vencido e retorno vencido.
- Rota `/equipe/observacoes`: texto integral, etapa, autor, data/hora e lead, mais recentes primeiro, filtro por corretor e etapa, cursor de data/id.
- Ficha `/leads/[id]`: observacoes do corretor atualmente responsavel; nao exibe anotacoes de um antigo responsavel.
- Polling de 60 s somente quando a aba estiver visivel. O projeto nao tem heartbeat de presenca do navegador; `available`, `paused` e `offline` sao exibidos como a disponibilidade atual, separados do plantao e da confirmacao de presenca.
- Sem migration ou nova flag. O gate existente do Supervisor Lite e o escopo ativo de tenant/equipe/unidade controlam as rotas.
- Composicao usa PeoplePage, PeopleSection, PeopleStats, Badge e Button existentes. Nao cria token, primitive ou animacao.

## Arquivos e validacao

- Arquivos principais: `control-queries.ts`, `control-core.ts`, `supervisor-control-panel.tsx` e `/api/supervisor/control` para o resumo e as pendencias; `observation-queries.ts`, `observations-core.ts`, `observations-list.tsx` e `/equipe/observacoes` para a consulta da equipe; `getLeadTimeline` e a ficha do lead para mostrar observacoes do corretor atual.
- A navegação Lite inclui o controle no menu do Supervisor. A rota e a API repetem a autorização por papel, equipe, unidade e gate Lite.
- A regra de primeira abordagem para leads `supervisor_import` usa `imported-first-contact.ts`, com o prazo confirmado de 24 h desde a distribuição. Lead com primeiro contato ou mensagem válida não aparece como pendência.
- Cobertura dirigida: 31 testes em seis arquivos passaram, incluindo prazo importado, primeiro contato já feito, retorno futuro/concluído, filtro e escopo das observações, visibilidade das rotas e navegação do assistente.
- TypeScript (`npx tsc --noEmit`) e ESLint dos arquivos alterados passaram. `npx next build --webpack` passou, com avisos existentes de `unpdf`/rotas dinâmicas.
- `agent:verify --level full`: documentação, escopo, arquitetura, segurança, desempenho e type-check passaram. O lint global parou no verificador de encoding por 952 ocorrências preexistentes em `docs/business-rules.md`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`; por isso o ESLint global não iniciou. ESLint focado nos arquivos desta feature passou.
- A suíte global terminou com 1.036 arquivos aprovados e 33 ignorados; 10 arquivos falharam: mocks de `drizzle-orm` incompletos em seis suítes, duas regras de cargos ausentes em ações de outras features, visibilidade preexistente de pós-venda e três testes em dois arquivos do botão de aceite de lead. Os 31 testes focados desta entrega passaram, incluindo o contrato atualizado do assistente.
- Banco: nenhum dado foi escrito; não foi usado `.env.local`; sem migration.
- Preview: a porta 3005 recusou conexão; nenhuma captura 1440/390 foi produzida e o servidor não foi reiniciado. O código compila as rotas `/equipe/controle`, `/equipe/observacoes` e `/api/supervisor/control`.

## Riscos e rollback

- A metrica de contatos e deliberadamente precisa: conta leads cujo `firstContactAt` ocorreu hoje, nao cada mensagem enviada.
- A atualizacao tem ate 60 s de atraso e interrompe consultas em aba escondida.
- O recorte de mensagens segue os sinais persistidos existentes; dados antigos sem `firstContactAt` e sem mensagem valida nao provam contato.
- Rollback: reverter os commits da feature; nao ha migration nem escrita em banco.
