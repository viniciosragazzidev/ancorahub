# Relatorio T57: estados vazios e mensagens de erro no Lite do corretor

Leitura apenas. Nenhum codigo foi alterado. Foram varridos: `src/features/broker-workspace/**`, `src/components/chat/**`, `src/components/light/**` e as paginas de `src/app/(dashboard)/{leads,clientes,minha-fila,plantoes,notificacoes,settings,relacionamento,jornada}/**`.

Regras das sugestoes: linguagem simples, dizer (1) por que esta vazio ou o que deu errado e (2) o que fazer agora, com rotulo de botao quando couber. Sem travessao, sem jargao tecnico.

Nota: onde o codigo usa `result.error ?? "texto"`, o texto listado e o fallback que o usuario ve quando o servidor nao devolve motivo. Ja existem textos bons no produto; esses estao marcados como "Manter".

---

## 1. Chat Lite (assistant) e telas de conversa

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/features/broker-workspace/chat/assistant-scripts.ts:221 | "Sem avisos novos." | "Voce nao tem avisos novos. Assim que a escala mudar ou um lead precisar de voce, o recado aparece aqui." |
| src/features/broker-workspace/chat/assistant-scripts.ts:241,424 | "Nenhum plantao agendado." | "Voce nao tem plantao marcado. Seu gestor ainda nao publicou a escala ou voce nao esta escalado. Fale com a gestao da unidade para entrar na escala." |
| src/features/broker-workspace/chat/assistant-scripts.ts:251,452 | "Sem retornos hoje." | "Nenhum retorno cai para hoje. Aparece aqui quando voce combina um novo contato com um cliente." |
| src/features/broker-workspace/chat/assistant-scripts.ts:359 | "Nenhum lead em atendimento." | "Voce nao tem nenhum lead em atendimento agora. Quando aceitar uma oferta, ele aparece nesta lista." |
| src/features/broker-workspace/chat/assistant-scripts.ts:387 | "Sem fila informada" | "Este lead nao esta em nenhuma fila." |
| src/features/broker-workspace/chat/assistant-scripts.ts:488 | "Nenhum lead hoje ainda. Assim que chegar, eu te aviso." | Bom texto. Manter. |
| src/features/broker-workspace/chat/assistant-scripts.ts:553 | "Nenhuma missao aberta por aqui." | "Voce nao tem missao aberta. Novas missoes aparecem aqui quando a gestao criar." |
| src/features/broker-workspace/chat/assistant-scripts.ts:580 | "Por aqui chegam os avisos da Ancora: escala publicada, recados da gestao e alertas dos seus leads. Nada novo por enquanto." | Bom texto. Manter. |
| src/features/broker-workspace/chat/insights-script.ts:148,188 | "Sem analise ainda" | "A IA ainda nao analisou esta conversa." |
| src/features/broker-workspace/chat/insights-script.ts:185 | "Ainda nao analisei a conversa com [nome]. A analise aparece aqui depois das proximas mensagens." | "A IA ainda nao analisou a conversa com [nome]. Envie e receba mais mensagens no WhatsApp que a analise aparece aqui." |
| src/features/broker-workspace/chat/quote-flow.ts:150 | "Nao achei plano para [perfil]. Tente outra abrangencia ou coparticipacao." | Bom texto. Manter e adicionar botao "Rever preferencias" para voltar ao passo anterior. |
| src/components/chat/chat-blocks.tsx:221 | "Nada por aqui." (fallback de lista) | "Nada por aqui ainda." |
| src/components/chat/chat-home.tsx:142 | "Nenhum lead com voce agora." / "Nada por aqui." | "Voce nao tem lead no momento. Assim que uma oferta chegar, ela aparece aqui." e na outra aba: "Nada por aqui ainda." |
| src/components/chat/chat-home.tsx:142 (busca) | "Nenhum lead com esse nome." | "Nao encontramos nenhum lead com esse nome. Confira a grafia ou limpe a busca." com botao "Limpar busca". |
| src/components/chat/thread-list-screen.tsx:59 | "Ninguem com esse nome." | "Nao encontramos ninguem com esse nome. Confira a grafia ou limpe a busca." com botao "Limpar busca". |
| src/components/chat/chat-screen.tsx:157 | "Nao consegui concluir agora. Tente de novo em instantes." | "Sua acao nao foi concluida. Toque de novo em alguns segundos; se continuar, fale com o suporte." |
| src/features/broker-workspace/chat/chat-actions.ts:55 | "Nao consegui aceitar esse lead." | "O aceite nao foi registrado. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:60 | "Nao consegui recusar esse lead." | "A recusa nao foi registrada. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:69 | "Nao consegui registrar o contato." | "O contato nao foi registrado. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:74 | "Nao consegui mudar a etapa." | "A etapa nao foi alterada. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:87 | "Nao consegui agendar o retorno." | "O retorno nao foi agendado. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:94 | "Nao consegui encerrar o atendimento." | "O atendimento nao foi encerrado. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:99 | "Nao consegui salvar a nota." | "A nota nao foi salva. Toque de novo em alguns segundos." |
| src/features/broker-workspace/chat/chat-actions.ts:121 | "Nao tinha nenhum pedido de confirmacao pendente." | "Nao havia pedido de confirmacao pendente. Nada foi alterado." |
| src/features/broker-workspace/chat/chat-actions.ts:127 | "Nao consegui concluir agora." | "Sua acao nao foi concluida. Toque de novo em alguns segundos." |

## 2. Telas Lite do corretor (inicio, leads, conversas, notificacoes, agenda, cotação)

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/features/broker-workspace/components/light-dashboard/index.tsx:71 | "Nao foi possivel carregar o seu inicio" + "Verifique a conexao e tente de novo. Seus leads continuam disponiveis na fila." + botao "Tentar de novo" | Bom e completo (motivo + acao + botao). Manter. |
| src/features/broker-workspace/components/light-dashboard/next-action.tsx:23 | "Tudo em dia" + "Quando chegar um lead ou uma tarefa, ela aparece aqui." + botao "Ver minha fila" | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-dashboard/agenda.tsx:30 | "Nenhum compromisso agendado. Retornos e tarefas com data aparecem aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-dashboard/format.ts:43 | "Nenhuma pendencia agora." | "Voce nao tem pendencias agora." |
| src/features/broker-workspace/components/light-leads-list.tsx:64 | "Nenhum lead novo" + "Quando um lead chegar para voce, ele aparece aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-leads-list.tsx:65 | "Nenhum atendimento em andamento" + "Leads aceitos ficam aqui ate serem fechados." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-leads-list.tsx:66 | "Nenhum retorno pendente" + "Leads sem atualizacao ha mais de 3 dias aparecem aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-leads-list.tsx:67 | "Nenhum lead com prazo em risco" + "Leads sem primeiro contato perto do limite aparecem aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-leads-list.tsx:68 | "Nada fechado ainda" + "Vendas concluidas e leads perdidos aparecem aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-leads-list.tsx:212 (busca) | "Nenhum resultado para [busca]" | "Nao encontramos nenhum lead com esse nome ou telefone. Confira a digitacao ou limpe a busca." com botao "Limpar busca". |
| src/features/broker-workspace/components/light-clients-list.tsx:87 | "Nenhum cliente ainda" + "Quando voce concluir uma venda, o cliente aparece aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-clients-list.tsx:87 (busca) | "Nenhum resultado para [busca]" + "Tente outro nome ou telefone." + botao "Limpar busca" | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-conversations-view.tsx:43,45 | "Ainda nao registrado" | "Sem data registrada." (e um campo de data/hora) |
| src/features/broker-workspace/components/light-conversations-view.tsx:55 | "Sem pendencia identificada" / "Analise pendente" | "A IA ainda nao identificou pendencia." / "Analise em andamento." |
| src/features/broker-workspace/components/light-conversations-view.tsx:180,182 | "Nenhuma conversa encontrada" + "Nenhum insight disponivel" | Manter o titulo e usar a descricao: "Suas conversas aparecem aqui depois que as mensagens do WhatsApp forem vinculadas aos leads." |
| src/features/broker-workspace/components/light-conversations-view.tsx:182 (busca) | "Nenhum resultado para [busca]" | "Nao encontramos nenhuma conversa com esse nome ou telefone. Confira a digitacao ou limpe a busca." com botao "Limpar busca". |
| src/features/broker-workspace/components/light-conversations-view.tsx:249 | "Sem conversa sincronizada" | "Esta conversa ainda nao foi sincronizada. As mensagens do WhatsApp vao aparecer aqui em instantes." |
| src/features/broker-workspace/components/light-conversations-view.tsx:327 | "Telefone indisponivel" | "Sem telefone cadastrado." |
| src/features/broker-workspace/components/light-conversations-view.tsx:346 | "Ainda nao ha analise suficiente. Continue atendendo pelo WhatsApp; quando houver mensagens vinculadas a este lead, os insights serao atualizados." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-conversations-view.tsx:384 | "Nenhuma mensagem vinculada a este contato foi sincronizada ainda." | "Nenhuma mensagem deste contato foi sincronizada ainda. Assim que o cliente escrever no WhatsApp, a conversa aparece aqui." |
| src/features/broker-workspace/components/light-notifications.tsx:163 | "Tudo lido" + "Voce esta em dia com as notificacoes." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-notifications.tsx:168,170 | "Nada urgente" + "Nao ha alertas que exijam uma acao imediata." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-notifications.tsx:176 | "Nenhuma notificacao" + "Alertas de leads, tarefas e atualizacoes aparecerao aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-notifications.tsx:231 | "Nao foi possivel carregar mais notificacoes. Tente novamente." | "Nao foi possivel carregar mais notificacoes. Toque em 'Carregar mais' de novo." |
| src/features/broker-workspace/components/light-duty-calendar.tsx:195,197 | "Nenhum plantao proximo" + "Quando voce estiver em uma escala ativa, os proximos horarios vao aparecer aqui." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-lead-detail/unavailable-view.tsx:17 | "Este atendimento foi redistribuido" + "Outro corretor assumiu este lead ou ele ja foi concluido." + botao "Voltar para a fila" | Bom e completo. Manter. |
| src/features/broker-workspace/components/duty-now-view.tsx:96 | "Nenhum lead ainda. Fique de olho: as ofertas chegam aqui e no seu celular." / "Nenhum lead ainda neste plantao." | Manter a primeira. A variante do plantao: "Nenhum lead ainda neste plantao. Continue disponivel: as ofertas vao aparecer aqui." |
| src/features/broker-workspace/components/light-feedback-view.tsx:87 | "Atualizacao registrada" + "O atendimento foi atualizado para [etapa]." | Bom e completo. Manter. |
| src/features/broker-workspace/components/light-quote-simulator/plans-step.tsx:80 | "Nenhum plano na comparacao" | "Nenhum plano na comparacao" + descricao: "Nao achamos planos com as preferencias escolhidas. Volte e mude abrangencia, coparticipacao ou faixa de preco." com botao "Rever preferencias". |
| src/features/broker-workspace/components/light-quote-simulator/plans-step.tsx:202 | "Nenhum exemplo corresponde a estes filtros" | "Nenhum exemplo com esses filtros. Ajuste a busca para ver mais modelos." com botao "Limpar filtros". |
| src/features/broker-workspace/components/light-quote-simulator/summary-step.tsx:22 | "Nenhum plano escolhido" | "Voce ainda nao escolheu um plano. Volte para a lista e toque em um plano para comparar aqui." com botao "Ver planos". |
| src/features/broker-workspace/components/light-quote-simulator/summary-step.tsx:137 | "Nenhum lead demonstrativo encontrado." | "Nenhum lead de exemplo encontrado." |
| src/features/broker-workspace/components/supervisor-team-invites.tsx:28 | "Convites da equipe indisponiveis" + "Tente novamente quando a estrutura de equipes estiver disponivel." | "Convites da equipe indisponiveis" + "A estrutura de equipes ainda nao foi montada nesta empresa. Fale com o diretor para configurar as equipes." |

### Erros (toast e acoes) no espaco do corretor

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/features/broker-workspace/components/accept-lead-button.tsx:23 | "Nao foi possivel aceitar o lead agora." | "O aceite nao foi registrado. Toque de novo em alguns segundos; se continuar, recarregue a tela." |
| src/features/broker-workspace/components/light-lead-detail/use-lead-detail.ts:127,132 | "Nao foi possivel aceitar o lead no momento." / "Nao foi possivel aceitar o lead." | "O aceite nao foi registrado. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-lead-detail/use-lead-detail.ts:165,172 | "Nao foi possivel recusar o lead." / "Nao foi possivel recusar no momento." | "A recusa nao foi registrada. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-lead-detail/use-lead-detail.ts:235,256 | "Nao foi possivel atualizar a etapa." / "Nao foi possivel atualizar no momento." | "A etapa nao foi alterada. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-lead-detail/use-lead-detail.ts:307 | "Erro no upload do documento." | "O documento nao foi enviado. Confira se o arquivo nao e grande demais e tente de novo." |
| src/features/broker-workspace/components/light-lead-detail/use-lead-detail.ts:338 | "Nao foi possivel solicitar a venda." | "A venda nao foi registrada. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-lead-detail/use-lead-detail.ts:354 | "Nao foi possivel enviar o documento." | "O documento nao foi enviado. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-feedback-view.tsx:65,70 | "Nao foi possivel registrar no momento." / "Nao foi possivel registrar a atualizacao." | "Sua atualizacao nao foi registrada. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-availability-banner.tsx:27 | "Nao foi possivel atualizar a disponibilidade." | "Sua disponibilidade nao foi atualizada. Toque de novo no interruptor." |
| src/features/broker-workspace/components/light-lead-toast-toggle.tsx:33 | "Nao foi possivel salvar a preferencia." | "Sua preferencia nao foi salva. Toque de novo." |
| src/features/broker-workspace/components/connection-badge.tsx:61 | "Nao foi possivel desconectar. Tente novamente." | "A conexao nao foi desfeita. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/connection-badge.tsx:69 | "Erro ao desconectar." | "A conexao nao foi desfeita. Toque de novo em alguns segundos." |
| src/features/broker-workspace/components/light-quote-simulator/use-quote-simulator.ts:179 | "Nao foi possivel copiar. Selecione e copie o resumo exibido." | Bom e completo. Manter. |
| src/features/broker-workspace/first-message/first-message-dialog.tsx:115 | "Nao consegui gerar o QR code agora. Tente de novo em instantes." | "Nao foi possivel gerar o codigo agora. Toque em 'Gerar codigo' de novo em alguns segundos." com botao "Gerar codigo". |
| src/features/broker-workspace/first-message/actions.ts:105 | "Nao consegui abrir agora. Tente de novo." | "Nao foi possivel abrir agora. Toque de novo em alguns segundos." |
| src/features/broker-workspace/experience-mode.ts:105 | "Nao foi possivel alterar o modo de uso." | "O modo de uso nao foi alterado. Toque de novo." |
| src/features/broker-workspace/broker-template-actions.ts:21 | "O conteudo da mensagem nao pode estar vazio." | "Escreva a mensagem antes de enviar." |
| src/features/broker-workspace/broker-template-actions.ts:71 | "Nenhum corretor valido foi encontrado para envio." | "Nao encontramos corretores validos para receber esta mensagem. Confira a unidade escolhida." |
| src/features/broker-workspace/broker-template-actions.ts:147,264 | "Erro ao processar envio de template para corretores." / "Erro ao enviar mensagem direta ao corretor." | "A mensagem nao foi enviada. Toque de novo em alguns segundos." |

## 3. Telas de Leads (area da gestao)

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/leads/error.tsx:10,11 | "Nao foi possivel carregar a lista de leads" + "A area de leads esta temporariamente indisponivel. Tente novamente ou volte para o Dashboard." | Manter o titulo e usar a descricao: "Nao foi possivel abrir a lista de leads agora. Toque em 'Tentar de novo'; se continuar, volte para o inicio." com botoes "Tentar de novo" e "Voltar para o inicio". |
| src/app/(dashboard)/leads/[id]/error.tsx:10,11 | "Nao foi possivel carregar este lead" + "O perfil do lead esta temporariamente indisponivel. Tente novamente ou volte para a lista de leads." | Manter o titulo e usar a descricao: "Nao foi possivel abrir a ficha deste lead agora. Toque em 'Tentar de novo'; se continuar, volte para a lista." com botoes "Tentar de novo" e "Voltar para a lista". |
| src/app/(dashboard)/leads/page.tsx:870 | "Nenhum lead encontrado com esses filtros" / "Sua proxima venda comeca aqui" | "Nenhum lead encontrado com esses filtros" + descricao: "Nenhum lead atende aos filtros escolhidos. Ajuste ou limpe os filtros para ver a lista completa." com botao "Limpar filtros". |
| src/app/(dashboard)/leads/leads-workspace.tsx:740 | "Nenhum lead em qualificacao no momento" + "Os contatos recebidos via webhook, WhatsApp ou CSV com qualificacao ativa aparecerao aqui enquanto o assistente realiza a triagem." | "Nenhum lead em qualificacao no momento" + "Novos contatos aparecem aqui enquanto a IA faz a triagem. Se ja passou tempo, confira se o envio esta funcionando nas integracoes." |
| src/app/(dashboard)/leads/leads-workspace.tsx:794 | "Nenhum lead sem atribuicao" + "Todos os leads operacionais possuem um corretor responsavel no momento." | Bom e completo. Manter. |
| src/app/(dashboard)/leads/leads-workspace.tsx:956 | "Nenhum lead nesta etapa" | "Nenhum lead nesta etapa agora. Leads que avancarem para esta etapa aparecerao aqui." |
| src/app/(dashboard)/leads/leads-workspace.tsx:371 | "Nao foi possivel distribuir os leads" | "Os leads nao foram distribuidos. Toque de novo em alguns segundos; se continuar, verifique se ha corretores disponiveis." |
| src/app/(dashboard)/leads/dashboard/page.tsx:31 | "Nenhum gargalo identificado." | "Nenhum gargalo identificado. Tudo na regua por enquanto." |
| src/app/(dashboard)/leads/arquivados/page.tsx:117 | "Nenhum lead arquivado encontrado" | "Nenhum lead arquivado por aqui. Leads retirados da distribuicao sem apagar o historico vao aparecer nesta lista." |
| src/app/(dashboard)/leads/_components/lead-assignment-history.tsx:134 | "Ainda nao abriu o WhatsApp" | "O corretor ainda nao abriu o WhatsApp." |
| src/app/(dashboard)/leads/_components/lead-assignment-history.tsx:164 | "Carregando historico..." | Bom texto. Manter. |
| src/app/(dashboard)/leads/_components/lead-assignment-history.tsx:168 | "Nenhuma movimentacao de atribuicao registrada ainda." | "Este lead ainda nao mudou de corretor. Assim que houver uma nova atribuicao, ela aparece aqui." |
| src/app/(dashboard)/leads/[id]/supervision-panel.tsx:266 | "Nao distribuido" | "Sem corretor atribuido." |
| src/app/(dashboard)/leads/[id]/supervision-panel.tsx:186 | "Ocorreu um erro ao assumir o atendimento." | "Voce nao assumiu o atendimento. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/[id]/register-sale-panel.tsx:158 | "Nenhum documento encontrado - anexe na secao de documentos" | "Nenhum documento anexado a este lead ainda. Va ate a secao de documentos e anexe o comprovante." |
| src/app/(dashboard)/leads/[id]/register-sale-panel.tsx:168 | "Nenhum documento aprovado ainda. Solicite a aprovacao do gestor." | Bom e completo. Adicionar botao "Solicitar aprovacao" se ainda nao solicitado. |
| src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:147 | "Erro ao mover lead para qualificacao." | "O lead nao foi movido para qualificacao. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:245 | "Ocorreu um erro ao assumir o atendimento." | "Voce nao assumiu o atendimento. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:441 | "Nao foi possivel consultar corretores" | "Nao foi possivel listar os corretores desta fila. Atualize a tela e tente de novo." |
| src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:445 | "Nenhum corretor ativo disponivel" / "Nenhum corretor elegivel neste plantao" / "Nenhum corretor ativo nesta unidade" | Acrescentar a cada um: "Nenhum corretor ativo nesta unidade agora. Coloque um corretor como disponivel ou escolha outra unidade." |
| src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:457 | "Nao foi possivel consultar os corretores desta fila. Atualize o drawer e tente novamente." | "Nao foi possivel listar os corretores desta fila. Atualize a tela e tente de novo." |
| src/app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:76 | "Erro ao qualificar lead." | "O lead nao foi qualificado. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:74 | "Erro ao iniciar qualificacao por IA." | "A qualificacao por IA nao começou. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:130 | "Nao foi possivel concluir a qualificacao." | "A qualificacao nao foi concluida. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:148 | "Erro ao alterar a fila de destino." | "A fila de destino nao foi alterada. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/status-actions.ts:135 | "Nenhum lead reatribuido. [motivo]" | "Nenhum lead foi reatribuido." + o motivo em frase simples, vindo do sistema. |
| src/app/(dashboard)/leads/status-actions.ts:340 | "Nenhum lead elegivel para distribuicao foi encontrado." | "Nenhum lead elegivel para distribuicao no momento. Leads prontos para receber corretor vao aparecer aqui." |

## 4. Distribuicao, filas e plantoes (gestao)

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/leads/distribuicao/page.tsx:153 | "Nenhuma filial cadastrada" | "Nenhuma filial cadastrada ainda. Cadastre a primeira filial para comecar a distribuir leads por unidade." com botao "Cadastrar filial". |
| src/app/(dashboard)/leads/distribuicao/page.tsx:799 | "Ainda nao ha eventos neste escopo" | "Nenhum evento registrado neste periodo. Mude o periodo ou a filial para ver movimentacoes." |
| src/app/(dashboard)/leads/distribuicao/page.tsx:849 | "Nenhuma pendencia automatica" | "Nenhuma pendencia automatica agora. Pendencias de cadastro vao aparecer aqui." |
| src/app/(dashboard)/leads/distribuicao/page.tsx:890,891 | "Falha de processamento · tentativa N" / "Sem detalhe adicional" | "Esta acao nao foi concluida. Toque em 'Tentar de novo'; se continuar, fale com o suporte." |
| src/app/(dashboard)/leads/distribuicao/page.tsx:905 | "Nenhuma excecao pendente." | "Nenhuma excecao pendente agora." |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:522 | "Nenhuma fila configurada" | "Nenhuma fila configurada ainda. Filas organizam os leads que aguardam corretor. Crie a primeira fila para comecar." com botao "Criar fila". |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:685 | "Nenhum plantao ativo disponivel." | "Nenhum plantao ativo agora. Ligue um plantao para vincular a fila a ele." |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:690 | "Nenhum plantao selecionado - disponibilidade padrao" | "Sem plantao selecionado: a fila segue a disponibilidade normal da unidade." |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:890 | "Nenhum corretor encontrado na(s) unidade(s) selecionada(s)." | "Nenhum corretor ativo nas unidades escolhidas. Coloque um corretor como disponivel ou escolha outra unidade." |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:1145 | "Leaves sem unidade ficarao na inbox geral." (contem erro de digitação em ingles) | "Leads sem unidade ficarao na lista geral." |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:1153 | "Nenhuma pendencia encontrada. A fila pode ser excluida normalmente." | Bom e completo. Manter. |
| src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:217,230,433,462 | "Nao foi possivel excluir a fila." / "Nao foi possivel forcar a exclusao." / "Nao foi possivel salvar a fila." / "Nao foi possivel simular." | Cada um: "A fila nao foi [excluida/salva]. Toque de novo em alguns segundos." A simulacao: "A simulacao nao rodou. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:313 | "Nenhuma regra de roteamento configurada" | "Nenhuma regra de roteamento configurada ainda. Regras decidem para qual fila ou unidade cada lead vai. Crie a primeira regra." com botao "Criar regra". |
| src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:216,229,246,271 | "Erro ao salvar regra de roteamento" / "Erro ao remover regra" / "Erro ao reordenar regras" / "Erro ao alterar status da regra" | "A regra nao foi [salva/removida/reordenada/alterada]. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:100 | "Falha ao [acao]." (descricao do toast) | "Nao foi possivel [acao]. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:723 | "Nao ha leads aguardando unidade ou corretor neste escopo." | "Nenhum lead aguardando unidade ou corretor neste escopo. Tudo em dia por aqui." |
| src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:731 | "Nenhum lead com os filtros atuais" | "Nenhum lead com os filtros atuais. Ajuste ou limpe os filtros para ver a lista completa." com botao "Limpar filtros". |
| src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:79 | "Erro ao carregar dados do resumo de desempenho." | "Nao foi possivel abrir o resumo de desempenho. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:107 | "Nenhum dado disponivel para exportar." | "Nao ha dados para exportar neste periodo. Mude o periodo e tente de novo." |
| src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:409 | "Nenhum corretor encontrado com os filtros selecionados." | "Nenhum corretor com os filtros escolhidos. Ajuste ou limpe os filtros para ver a equipe completa." com botao "Limpar filtros". |
| src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:194,207 | "Nao foi possivel gerar o PDF." | "O arquivo nao foi gerado. Toque em 'Gerar PDF' de novo em alguns segundos." com botao "Gerar PDF". |
| src/app/(dashboard)/leads/distribuicao/_components/broker-acceptance-sla-panel.tsx:50 | "Nao foi possivel salvar os parametros." | "Os parametros nao foram salvos. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/_components/queues/meta-entries.tsx:35 | "Nenhuma campanha nesta lista." | "Nenhuma campanha nesta lista ainda. Campanhas podem ser vinculadas nas filas." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:422,427 | "Escala mensal indisponivel" + "Nao foi possivel carregar a escala deste mes." | "Nao foi possivel abrir a escala deste mes" + "Toque em 'Tentar de novo'; se continuar, fale com o suporte." com botao "Tentar de novo". |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:490 | "Nada no periodo" | "Nenhum plantao neste periodo." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:498 | "Nenhum plantao ainda vai acontecer neste periodo. Crie um novo." | "Nenhum plantao marcado neste periodo ainda. Crie um novo para escalar os corretores." com botao "Criar plantao". |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:523,766 | "Nenhum corretor encontrado." | "Nenhum corretor encontrado com esses filtros. Confira a unidade e o periodo escolhidos." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:684 | "Nenhum corretor neste filtro." | "Nenhum corretor neste filtro. Ajuste a busca para ver a equipe." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:786 | "Nenhum plantao neste filtro." | "Nenhum plantao neste filtro. Ajuste o periodo ou a unidade." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:310 | "Nao foi possivel concluir a acao." | "A acao nao foi concluida. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:305,784,809,832,847,1410 | "Nao foi possivel salvar o plantao." / "Nao foi possivel atualizar o plantao." / "Nao foi possivel escalar o corretor." / "Nao foi possivel trocar o turno." / "Nao foi possivel remover o corretor." / "Nao foi possivel estender o plantao." | Cada um: "O plantao nao foi [salvo/atualizado]. Toque de novo em alguns segundos." / "O corretor nao foi [escalado/removido]. Toque de novo em alguns segundos." / "O turno nao foi trocado. Toque de novo em alguns segundos." / "O plantao nao foi estendido. Toque de novo em alguns segundos." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:343 | "Nenhum tipo ainda" (placeholder do campo tipo) | "Nenhum tipo criado" + descricao de ajuda: "O tipo e o grupo do plantao, como PME ou Premium. Crie o primeiro em 'Novo tipo'." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:441 | "Nenhum dia selecionado no periodo." | "Nenhum dia escolhido no periodo. Marque pelo menos um dia para criar o plantao." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:623 | "Nenhuma fila ativa." | "Nenhuma fila ativa no momento. Crie ou ative uma fila para vincular ao plantao." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:651 | "Nenhuma fila: o plantao nao recebe leads de fila." / "Nenhuma agora: da para vincular depois." | Manter as duas; sao claras. |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1036 | "Nenhum corretor elegivel encontrado." | "Nenhum corretor elegivel neste momento. Confira se ha corretores disponiveis e se a unidade participa do tipo do plantao." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1085 | "Ninguem neste turno." / "Nenhum corretor escalado." | "Nenhum corretor neste turno." / "Nenhum corretor escalado ainda. Escalando, os nomes aparecem aqui." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1120 | "Nenhum evento de historico disponivel." | "Nenhum evento registrado ainda. Alteracoes neste plantao vao aparecer aqui." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1513 | "Nenhum plantao acontece em [mes]" | "Nenhum plantao marcado para [mes]. Crie um novo ou estenda um plantao existente." com botao "Criar plantao". |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-type-ui.tsx:238 | "Nenhum tipo ainda. Crie o primeiro (ex.: PME, Presencial, Online)." | Bom e completo. Manter, com botao "Criar o primeiro". |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/broker-day-history-trigger.tsx:109 | "Nenhum lead recebido neste dia." | "Nenhum lead recebido neste dia. Quando o corretor receber uma oferta, ela aparece aqui." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/broker-day-history-trigger.tsx:135 | "Nenhuma oferta neste dia." | "Nenhuma oferta enviada neste dia." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/broker-occurrence-card.tsx:172 | "Nenhum lead aguardando corretor nas filas deste plantao." | "Nenhum lead aguardando corretor nas filas deste plantao. Novos leads vao aparecer aqui." |
| src/app/(dashboard)/leads/distribuicao/plantao/_components/broker-occurrence-card.tsx:186 | "Nenhum lead recebido nesta ocorrencia." | "Nenhum lead recebido nesta parte do plantao. Assim que um lead chegar, ele aparece aqui." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:116 | "Este turno foi encerrado. Consulte a distribuicao, as ofertas e os corretores escalados sem alterar o plantao." | Bom e completo. Manter. |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:129 | "Sem confirmacoes registradas" | "Nenhuma confirmacao registrada nesta data." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:149 | "Nenhuma atribuicao registrada neste periodo." | "Nenhuma atribuicao registrada neste periodo. Mude o periodo para ver outras distribuicoes." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:168 | "Nenhum vinculo de escala encontrado para esta data." | "Nenhum corretor na escala desta data. Confira a escala em outro dia ou publique a escala." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:341 | "Nenhuma fila vinculada" | "Nenhuma fila vinculada a este plantao. Vincule uma fila para o plantao receber leads." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:432 | "Nenhum lead distribuido neste turno." | "Nenhum lead distribuido neste turno. Leads que chegarem vao aparecer aqui." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:495 | "Nenhum lead [canal] nesta situacao para este plantao [periodo]." | "Nenhum lead [canal] nesta situacao agora. Mude o filtro ou o periodo para ver outros." |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:512 | "Nenhum escalado esta elegivel para receber leads. Ha pendencias de cadastro ou confirmacao - os leads permanecem aguardando." | "Nenhum corretor escalado pode receber lead agora. Falta cadastro ou confirmacao de algum corretor; ate resolver, os leads ficam aguardando." com botao "Ver pendencias" se houver. |
| src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:552,555 | "Nenhum corretor nesta secao." / "Nenhum corretor escalado neste plantao." | "Nenhum corretor neste turno." / "Nenhum corretor escalado ainda. Escalando, os nomes aparecem aqui." |

## 5. Clientes

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/clientes/clientes-list.tsx:219 | "Nenhum cliente convertido ainda" | "Nenhum cliente convertido ainda. Quando um lead virar venda, ele aparece nesta lista." |
| src/app/(dashboard)/clientes/clientes-list.tsx:257 | "Nenhum cliente encontrado" | "Nenhum cliente com esses filtros. Ajuste a busca ou limpe os filtros para ver a lista completa." com botao "Limpar filtros". |
| src/app/(dashboard)/clientes/[clientId]/page.tsx:463 | "Nenhuma venda registrada" | "Nenhuma venda registrada para este cliente ainda. Registre a primeira venda na ficha do lead." |
| src/app/(dashboard)/clientes/[clientId]/page.tsx:501 | "Nenhuma interacao registrada" | "Nenhuma interacao registrada ainda. Ligar, WhatsApp e notas do atendimento vao aparecer aqui." |

## 6. Minha fila (visao do corretor)

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/minha-fila/page.tsx:536 | "Ainda nao ha plantoes publicados para voce neste periodo." | "Voce nao tem plantao publicado neste periodo. Sua escala aparece aqui quando o gestor publicar." |
| src/app/(dashboard)/minha-fila/page.tsx:605 | "Nenhuma tarefa pendente." | "Voce nao tem tarefa pendente. Novas tarefas vao aparecer aqui." |
| src/app/(dashboard)/minha-fila/page.tsx:668 | "Nenhuma meta ativa no periodo." | "Nenhuma meta ativa neste periodo. Metas da equipe vao aparecer aqui quando a gestao criar." |
| src/app/(dashboard)/minha-fila/_components/queue-client.tsx:151,152 | "Nenhum lead encontrado para essa busca." / "Nenhum lead na sua fila ainda." | Busca: "Nenhum lead com esse nome ou telefone. Confira a digitacao ou limpe a busca." com botao "Limpar busca". Fila: "Voce nao tem lead na fila agora. Fique disponivel: as ofertas vao aparecer aqui." |
| src/app/(dashboard)/minha-fila/_components/queue-client.tsx:227 | "Nenhum lead encontrado" | "Nenhum lead com os filtros atuais. Ajuste ou limpe os filtros." com botao "Limpar filtros". |
| src/app/(dashboard)/minha-fila/_components/broker-availability.tsx:51 | "Nao foi possivel atualizar a disponibilidade." | "Sua disponibilidade nao foi atualizada. Toque de novo no interruptor." |
| src/app/(dashboard)/minha-fila/_components/broker-availability.tsx:46,47 | "Voce esta pausado. Nao recebera novos leads temporariamente." / "Voce esta desconectado. Nao recebera leads ou notificacoes." | Bom e completo. Manter. |

## 7. Notificacoes

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/notificacoes/notifications-client.tsx:97 | "Nada urgente" + "Nao ha alertas que exijam uma acao imediata." | Bom e completo. Manter. |
| src/app/(dashboard)/notificacoes/notifications-client.tsx:98 | "Nenhuma notificacao" + "Alertas de leads, tarefas e atualizacoes aparecerao aqui." | Bom e completo. Manter. |
| src/app/(dashboard)/notificacoes/notifications-client.tsx:147 | "Erro ao carregar mais notificacoes. Tente novamente." | "Nao foi possivel carregar mais notificacoes. Toque em 'Carregar mais' de novo." |
| src/app/(dashboard)/notificacoes/lead-toast-toggle.tsx:27 | "Nao foi possivel salvar a preferencia." | "Sua preferencia nao foi salva. Toque de novo." |

## 8. Relacionamento e jornada

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/relacionamento/page.tsx:58 | "Recados ainda desligados" + "A Central de relacionamento ainda nao esta ligada nesta empresa. Peça ao diretor para ativar." | "Recados ainda desligados" + "A Central de relacionamento ainda nao foi ativada nesta empresa. Fale com o diretor para ativar." |
| src/app/(dashboard)/jornada/page.tsx:24 | "Sua jornada esta quase pronta" + "Nao conseguimos carregar seus pontos agora. Tente de novo em alguns minutos." | "Sua jornada esta quase pronta" + "Nao foi possivel carregar seus pontos agora. Toque em 'Tentar de novo' em alguns minutos." com botao "Tentar de novo". |
| src/features/journey/components/director/audit-tab.tsx:48 | "Nada fora do padrao nesta semana" + "Os pontos estao parecidos entre os corretores." | Bom e completo. Manter. |
| src/features/journey/components/director/audit-tab.tsx:68 | "Nenhum ponto ainda" + "Os eventos aparecem aqui conforme a equipe pontua." | Bom e completo. Manter. |
| src/features/journey/components/director/campaigns-tab.tsx:92 | "Nenhuma campanha ainda" + "Ex.: Semana PME, 3 cotacoes PME, +100 pts para a unidade Centro." + botao "Criar a primeira" | Bom e completo. Manter. |
| src/features/journey/components/director/director-journey-panel.tsx:96 | "Nenhum ponto nesta semana ainda." | "Nenhum ponto nesta semana ainda. Pontos aparecem aqui quando a equipe pontuar." |
| src/features/journey/components/director/director-journey-panel.tsx:115 | "Sem unidades com corretores ativos." | "Nenhuma unidade com corretores ativos. Coloque ao menos um corretor como disponivel." |
| src/features/journey/components/director/director-journey-panel.tsx:131 | "Nenhuma equipe de supervisor com pontos ainda." | "Nenhuma equipe de supervisor pontuou ainda. Pontos aparecem aqui quando a equipe agir." |
| src/features/journey/components/director/director-journey-panel.tsx:145 | "Nenhuma missao concluida ainda." | "Nenhuma missao concluida ainda. Missoes aparecem aqui quando a gestao criar e a equipe concluir." |
| src/features/journey/components/journey-screen.tsx:156 | "Sem plantao hoje: esta fica para o proximo." | Bom e completo. Manter. |
| src/features/journey/actions.ts:23 | "Selecione ate 20 avisos validos. Tente novamente." | "Selecione no maximo 20 avisos. Desmarque alguns e tente de novo." |
| src/features/journey/actions.ts:37 | "Nao foi possivel confirmar. Tente novamente." | "A confirmacao nao foi registrada. Toque de novo em alguns segundos." |
| src/features/journey/actions.ts:58 | "Nao foi possivel salvar. Tente novamente." | "A alteracao nao foi salva. Toque de novo em alguns segundos." |
| src/features/journey/ranking-preferences.tsx:25 | "Nao foi possivel salvar. Tente novamente." | "Sua preferencia nao foi salva. Toque de novo em alguns segundos." |

## 9. Configuracoes (settings)

| Arquivo:linha | Texto atual | Sugestao |
|---|---|---|
| src/app/(dashboard)/settings/_components/integrations-tab.tsx:183 | "Nenhuma fonte configurada" + "Crie um token para comecar a receber leads automaticamente." | "Nenhuma fonte de leads configurada ainda. Crie uma chave de acesso para comecar a receber leads automaticamente." com botao "Criar chave". |
| src/app/(dashboard)/settings/_components/integrations-tab.tsx:140 | "Sem conexao com o servidor." | "Nao foi possivel carregar agora. Confira sua conexao de internet e tente de novo." |
| src/app/(dashboard)/settings/_components/integrations-tab.tsx:238 | "Falha no envio" | "O envio nao saiu. Toque em 'Testar' de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/integrations-tab.tsx:60,69,83,88,105 | "Nao foi possivel criar a integração." / "Nao foi possivel atualizar o status." / "Nao foi possivel revogar a integração." | "A fonte nao foi [criada/atualizada/revogada]. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/passkey-section.tsx:238 | "Nenhuma biometria cadastrada ainda" | "Nenhuma biometria cadastrada ainda. Cadastre o leitor de digital do seu aparelho para entrar com 1 toque." com botao "Cadastrar biometria". |
| src/app/(dashboard)/settings/_components/passkey-section.tsx:78,86,101,108,118,123 | "Nao foi possivel cadastrar a biometria." / "Nao foi possivel renomear." / "Nao foi possivel excluir." | "A biometria nao foi [cadastrada/renomeada/excluida]. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/security-tab.tsx:38,47,55,59,67,71 | "Nao foi possivel ativar o 2FA." / "Nao foi possivel desativar o 2FA." / "Nao foi possivel gerar novos codigos." | "A protecao em duas etapas nao foi [ativada/desativada]. Toque de novo em alguns segundos." / "Os codigos de recuperação nao foram gerados. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/security-tab.tsx:87 | "Nao configurado" | "Protecao em duas etapas desligada." |
| src/app/(dashboard)/settings/_components/agent-training-tab.tsx:59 | "Nao foi possivel concluir a acao." | "A acao nao foi concluida. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/agent-training-tab.tsx:187 | "Ainda nao ha versoes. Crie o primeiro rascunho." | "Nenhuma versao criada ainda. Crie o primeiro rascunho para treinar o agente." com botao "Criar rascunho". |
| src/app/(dashboard)/settings/_components/agent-training-tab.tsx:199 | "Sem resumo" | "Sem resumo ainda." |
| src/app/(dashboard)/settings/_components/ai-settings-tab.tsx:30 | "Nao foi possivel salvar." | "As configuracoes nao foram salvas. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/distribution-policy-panel.tsx:49 | "Nao foi possivel salvar a politica." | "A politica nao foi salva. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/empresa-tab.tsx:30 | "Erro ao salvar." | "As alteracoes nao foram salvas. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/feedback-tab.tsx:40 | "Erro ao salvar." | "As alteracoes nao foram salvas. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/_components/waha-connections-card.tsx:356 | "Nenhum numero conectado neste escopo." | "Nenhum numero de WhatsApp conectado ainda. Conecte um numero para enviar e receber mensagens." com botao "Conectar numero". |
| src/app/(dashboard)/settings/feedback-templates/client.tsx:200 | "Nenhum template criado ainda." | "Nenhum template criado ainda. Templates deixam a resposta mais rapida. Crie o primeiro." com botao "Criar template". |
| src/app/(dashboard)/settings/waha-connection-actions.ts:14,19,24,39 | "Nao foi possivel iniciar a conexao." / "Nao foi possivel atualizar a conexao." / "Nao foi possivel alterar a conexao." / "Nao foi possivel atualizar as funcoes." | "A conexao com o WhatsApp nao foi [iniciada/atualizada/alterada]. Toque de novo em alguns segundos." / "As funcoes nao foram atualizadas. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/whatsapp-actions.ts:126 | "Nao foi possivel conectar ao servico de WhatsApp em [servidor]. Verifique se o VPS esta online e acessivel. Detalhes: [detalhe tecnico]" | "Nao foi possivel conectar ao WhatsApp agora. Toque em 'Tentar de novo'; se continuar, fale com o suporte." |
| src/app/(dashboard)/settings/whatsapp-actions.ts:266,316,382,555 | "Nao foi possivel iniciar o WhatsApp." / "Nao foi possivel consultar a conexao." / "Nao foi possivel consultar o status." / "Nao foi possivel recuperar a sessao do WhatsApp." | "O WhatsApp nao foi [iniciado/recuperado]. Toque de novo em alguns segundos." / "Nao foi possivel ver o estado da conexao. Atualize a tela." |
| src/app/(dashboard)/settings/whatsapp-actions.ts:419 | "Nao foi possivel acessar [servidor] ([tipo]). [detalhe tecnico]" | "Nao foi possivel acessar o WhatsApp agora. Fale com o suporte." |
| src/app/(dashboard)/settings/whatsapp-actions.ts:456 | "Nao foi possivel confirmar a desconexao da sessao do WhatsApp." | "A sessao do WhatsApp nao foi encerrada. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/actions.ts:45 | "Erro ao salvar identidade visual." | "A identidade visual nao foi salva. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/feedback-actions.ts:61 | "Erro ao salvar configuracao de feedback." | "A configuracao de feedback nao foi salva. Toque de novo em alguns segundos." |
| src/app/(dashboard)/settings/integrations-actions.ts:48 | "Sem permissao para consultar integracoes." | "Voce nao tem acesso a esta area. Fale com o diretor da empresa." |
| src/app/(dashboard)/settings/integrations-actions.ts:103,118,130 | "Nao foi possivel criar a integração." / "Nao foi possivel atualizar a integração." / "Nao foi possivel revogar a integração." | "A fonte nao foi [criada/atualizada/revogada]. Toque de novo em alguns segundos." |

---

## Resumo

- Total de itens listados: 212 (cada linha de arquivo:linha acima e um item; linhas com virgula indicam varios pontos no mesmo arquivo com o mesmo texto).
- Os que ja estao bons e basta manter: 38.
- Os que precisam de reescrita: 174.
- Achados extras que nao sao texto de interface mas merecem correcao: `queue-control-center.tsx:1145` tem "Leaves" (palavra em ingles por engano) e dois textos usam travessao no codigo (`register-sale-panel.tsx:158` e `queue-control-center.tsx:690`); as sugestoes acima ja trazem as versoes sem travessao e sem a palavra errada.
- Nenhum codigo foi alterado nesta tarefa; o relatorio e o unico arquivo escrito.
