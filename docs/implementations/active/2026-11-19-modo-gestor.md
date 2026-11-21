# Modo gestor completo e utilizável (19/11/2026)

**Pedido (19/11):** "gere um plano completo para configurar e ativar e deixar completamente utilizável o modo gestor,
a tela dele; veja todas as necessidades dele e as que não precisa que ele veja, ative, configure e mande".

**Base:** a decisão de 10/11 continua valendo (`2026-11-10-gestor-versao-antiga-escopo-unidade.md`). O gestor usa o
modo normal (sem Lite e sem o visual Arc) e só vê a gestão da própria unidade. Este plano fecha o que ficou aberto e
deixa a tela dele sem becos sem saída.

## 1. Como está hoje (levantado no código em 19/11)

- O gestor está sempre no modo normal: `experience-mode.ts:60` e `lite-audience.ts:19-21`. A chave
  `feature_manager_lite_enabled` não vale mais para ele.
- Fonte única das rotas: `src/features/manager-scope/manager-routes.ts` (`MANAGER_ALLOWED_ROUTES`). Ela vale para o
  menu, o layout do painel e os layouts das áreas (`redirectManagerAway`).
- Gestor = papel `manager` fora das funções marketing e financeiro (`isOutsideManagerScope`).

## 2. O que o gestor PRECISA e vê

| Necessidade | Onde | Escopo |
|---|---|---|
| Ver o dia da unidade | Painel `/dashboard` | métricas por unidade (`metric-scope.ts`); sem unidade, vazio |
| Ver e gerir os corretores | Equipe `/equipe`, perfil `/equipe/[id]`, unidade `/unidades/[id]` | só a unidade |
| Disponibilidade dos corretores | Reativar/pausar na unidade; "Retomar recebimento" em massa (já reativa offline, `d63892fe`) | só a unidade |
| Convidar corretor | `/equipe/convidar` | cria acesso só na unidade dele |
| Acompanhar plantões | Plantões da unidade `/equipe/plantoes` (hoje + 7 dias) e plantão do corretor `/plantoes/corretor/[id]` | só corretores da unidade, só leitura |
| Transferências de lead | Painel de transferências na Equipe | unidade da sessão |
| Abrir um lead do corretor | `/leads/[id]` a partir do perfil | lead da unidade |
| Avisos e conta | `/notificacoes`, Ajustes (conta e segurança) | próprio usuário |
| Financeiro e metas da unidade (com ERP ligado) | `/financeiro`, `/metas`, relatórios ERP | unidade (`erp/scope.ts`); livros da agência fechados |

## 3. O que o gestor NÃO vê

Configuração do sistema, distribuição e filas, conversas de qualificação, lista geral de leads, comercial (vendas,
negociações, cotação), marketing, atendimento IA, integrações, cargos, relatórios gerais, pós-venda e Gestão
(`/gestao`). Tudo isso é negado no servidor pela lista de rotas e pelos layouts das áreas.

## 4. Feito nesta entrega (19/11)

1. **Painel sem becos sem saída.** O Painel do gestor (`CommandCenter`) apontava para distribuição, lista de leads,
   conversas, cotação, vendas e relatórios, e o clique caía em `/equipe`.
   - Novo `src/features/dashboard/components/allowed-link.tsx`: `UnitManagerLinks` e `AllowedLink` usam
     `isManagerRouteAllowed`. Rota bloqueada vira texto (cartões com número) ou some (atalhos e "Ver mais").
   - Atalhos do gestor: "Plantões da unidade" e "Minha equipe" no lugar de distribuição, conversas, cotação, vendas e
     relatórios.
   - Busca de lead e "Novo lead" saem para o gestor (levam à lista de leads, que é do diretor).
   - "Ver plantões" leva o gestor a `/equipe/plantoes`.
   - Vale também para "Precisam de atenção" e "Atividade do WhatsApp" (`dashboard-widgets.tsx`,
     `whatsapp-activity-card.tsx`). Para o diretor nada muda.
2. **Aba Qualidade sem filas de outras unidades.** O filtro por fila listava as filas da empresa toda
   (`dashboard/page.tsx`). Para o gestor a lista vem vazia; o relatório continua escopado à unidade.
3. **Equipe sem vazamento para gestor sem unidade.** A lista de corretores (`equipe/page.tsx`) caía na empresa
   toda quando o gestor não tinha unidade. Agora não mostra ninguém (fail closed), como o resto da página.

Testes: `allowed-link.test.tsx` (gestor x diretor). Testes de `dashboard`, `manager-scope` e das páginas de Painel e
Equipe passando; typecheck limpo.

## 5. Decisões tomadas pelo recomendado

1. **Manter o modo normal** (decisão de 10/11). As telas Lite do gestor (`manager-workspace/*`) ficam no código para
   uma volta futura.
2. **Plantões continuam só leitura** para o gestor; criar, editar e escalar ficam com o diretor (decisão 3 de 10/11).
3. **ERP da unidade continua aberto** (financeiro, metas e relatórios ERP escopados à unidade). Não é configuração do
   sistema, e os livros da agência já são fechados.
4. **Venda Automatizada fica como está.** A função foi desenhada depois de 10/11 para "o diretor ou o gestor" escolher
   a negociação (`auto-sale/service.ts:116`); a tela `/vendas` segue fora do menu do gestor. Se o gestor não deve
   escolher, basta trocar `assertManager` por `isOutsideManagerScope`.

## 6. Pendências fechadas em 20/11 ("faz todos recomendados")

| # | O quê | Feito |
|---|---|---|
| P1 | Pós-venda do gestor | **Volta, escopado à unidade.** `/equipe/pos-venda` entrou em `MANAGER_ALLOWED_ROUTES` e o layout que barrava saiu. As ações já escopavam tudo à unidade da sessão (campanhas criadas por ele ou com público da unidade, respostas e alertas de leads da unidade, relatório só dos corretores da unidade); régua automática e regra R0 continuam só com o diretor (`canEdit` falso). "Abrir conversa" (conversas de qualificação, do diretor) some para o gestor. Gestor sem unidade não vê a aba (layout do painel) e a página nega. |
| P2 | Gestão (`/gestao`) no modo normal | Não feito, pelo recomendado: Equipe e unidade cobrem. |
| P3 | Funções com papel manager barradas por `role === "manager"` puro | Marketing: a função marketing abre `/marketing`; gestor de unidade e financeiro continuam fora. Qualificação, integrações e distribuição continuam negadas a qualquer manager, como antes de 10/11 (não são áreas dessas funções). |
| P4 | Plantão "todas as unidades" com corretor de outra unidade | Esperado pela regra de escopo; nada a mudar. |
| P5 | Conferência visual | Feita em `/dev/gestor-preview?caso=matriz\|niteroi\|sem-unidade&tela=painel\|pos-venda`, com os componentes reais e dados de exemplo (o localhost aponta para o banco de produção, onde não há contas de teste; não se entrou como gestor real). Prints na pasta de notas da sessão (`gestor-prints-2026-11-20`). Achado e corrigido: o gestor sem unidade via a aba Pós-venda e caía em Acesso negado. **Falta**: um gestor real conferir depois do deploy. |
| P6 | Aviso aos gestores | Texto abaixo, para o usuário mandar pelo canal que escolher (não pelo número oficial). Nada foi enviado. |

### Texto do aviso aos gestores (P6, para o usuário enviar)

> Oi! O Painel do AncoraHub do gestor mudou um pouco:
> - Os atalhos agora levam para o que é seu: **Plantões da unidade**, **Minha equipe** e **Convidar corretor**.
> - Os números do dia continuam lá, só da sua unidade.
> - O **Pós-venda** voltou (Equipe → Pós-venda) com as pesquisas e respostas dos clientes da sua unidade. Você pode criar campanhas para a sua unidade; a régua automática continua com a direção.
> - Para reativar um corretor que ficou fora do ar: Equipe → sua unidade → Reativar.
> Qualquer coisa estranha, me chama.
