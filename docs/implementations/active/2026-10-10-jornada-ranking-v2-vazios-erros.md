# Vazios e erros do Lite do corretor (E6/E9), levantado em 2026-10-10

Regras: (1) dizer por que está vazio ou o que deu errado em palavras simples; (2) dizer o que fazer agora; (3) ter 1 ação quando houver próximo passo óbvio; (4) sem jargão (erro, falha ao carregar, sincronizada, vinculada, configurado, servidor); (5) sem travessão. Nenhum travessão encontrado em texto de tela.

**Dois padrões transversais:**
- **Erro cru vaza:** vários pontos mostram `res.error`, `err.message` ou `error.message` direto. Trocar por texto amigável sempre (logar o técnico no console do servidor).
- **"Não foi possível X." sem próximo passo:** terminar com "Tente de novo em instantes." ou a ação certa.

## Para corrigir (37)

| Tela | Arquivo:linha | Hoje | Sugestão | Ação |
|---|---|---|---|---|
| Início | broker-workspace/components/light-dashboard/index.tsx:71-72 | "Não foi possível carregar o seu início" / "Verifique a conexão..." | "Seu início não abriu agora" / "Confira sua internet e tente de novo. Seus leads continuam na fila." | "Tentar de novo" + "Ver minha fila" |
| Início chat | components/chat/chat-home.tsx:142 | "Nada por aqui." | "Nenhuma conversa por aqui ainda. Puxe pela Âncora no Início." | |
| Início chat | components/chat/chat-home.tsx:142 | "Nenhum lead com você agora." | "Nenhum lead com você agora. Fique disponível para receber os próximos." | "Ver plantões" |
| Início chat | broker-workspace/chat/chat-actions.ts:55,60,69,74,87,94,99 | "Não consegui aceitar esse lead." etc. (+ `result.error` cru) | mesmo texto + " Tente de novo em instantes." e nunca o erro cru | |
| Início chat | broker-workspace/chat/chat-actions.ts:127 | `error.message` ou "Não consegui concluir agora." | sempre "Não consegui concluir agora. Tente de novo em instantes." | |
| Início chat | broker-workspace/chat/assistant-scripts.ts:241, :424 | "Nenhum plantão agendado." | "Você não tem plantão marcado. Quando o supervisor colocar você na escala, eu aviso aqui." | "Ver plantões" |
| Início chat | broker-workspace/chat/assistant-scripts.ts:553 | "Nenhuma missão aberta por aqui." | "Nenhuma missão aberta agora. Novas missões aparecem todo dia." | "Ver minha jornada" |
| Fila/Leads | broker-workspace/components/light-leads-list.tsx:64 | "Nenhum lead novo" / "Quando um lead chegar..." | "Fique disponível no plantão para receber os próximos leads." | "Ver plantões" |
| Fila/Leads | light-leads-list.tsx:65 | "Nenhum atendimento em andamento" / "Leads aceitos ficam aqui..." | "...Aceite um lead novo para começar um atendimento." | "Ver leads novos" |
| Fila | broker-workspace/components/accept-lead-button.tsx:23 | `result.error` ou "Não foi possível aceitar o lead agora." | "Não deu para aceitar agora. Tente de novo; se o lead sumir, outro corretor já pegou." | |
| Lead | light-lead-detail/use-lead-detail.ts:127, :132 | aceitar (idem) | idem acima | |
| Lead | use-lead-detail.ts:165, :172 | recusar | "Não deu para devolver o lead agora. Tente de novo em instantes." | |
| Lead | use-lead-detail.ts:210-211 | "Proteção de Regressão IA: É obrigatório fornecer uma justificativa detalhada com no mínimo 15 caracteres." | "Esse lead parecia perto de fechar. Conte em poucas palavras por que ele voltou de etapa (mínimo 15 letras)." | |
| Lead | use-lead-detail.ts:235, :256 | etapa | "Não deu para mudar a etapa agora. Tente de novo em instantes." | |
| Lead | use-lead-detail.ts:338 | solicitar venda | "Não deu para enviar a venda para conferência. Seus documentos estão salvos; tente de novo." | |
| Lead | use-lead-detail.ts:354 | `err.message` ou "Não foi possível enviar o documento." | "O documento não subiu. Confira a internet e o tamanho do arquivo e tente de novo." | |
| Lead | light-lead-detail/action-bar.tsx:66 | "WhatsApp indisponível" | "Sem WhatsApp no cadastro" | "Ligar" se houver telefone |
| Lead | light-lead-detail/sale-doc-sheet.tsx:69 | "Nenhum tipo de documento configurado." | "Ainda não há tipos de documento para escolher. Fale com seu supervisor." | |
| Feedback | broker-workspace/components/light-feedback-view.tsx:65, :70 | "Não foi possível registrar..." | "Não deu para salvar a atualização. Tente de novo em instantes." | |
| 1ª mensagem | first-message/actions.ts:137 | "Seu WhatsApp não está conectado." | "...Conecte em Configurações para mandar a mensagem por aqui." | "Conectar WhatsApp" |
| 1ª mensagem | first-message/actions.ts:84, :122 | "Este lead não está com você." | "Este lead não está mais com você. Volte para a fila para ver os seus." | "Voltar para a fila" |
| Conversas | light-conversations-view.tsx:182-184 | "Nenhum insight disponível" / "...vinculada..." | "Nenhuma conversa ainda" / "Converse com seus leads pelo WhatsApp conectado e o resumo aparece aqui." | "Conectar WhatsApp" |
| Conversas | light-conversations-view.tsx:249 | "Sem conversa sincronizada" | "Sem mensagens ainda" | |
| Conversas | light-conversations-view.tsx:327 | "Telefone indisponível" | "Sem telefone no cadastro" | |
| Conversas | light-conversations-view.tsx:346 | "Ainda não há análise suficiente... insights..." | "A Âncora ainda não leu mensagens suficientes. Continue no WhatsApp que o resumo aparece aqui." | |
| Conversas | light-conversations-view.tsx:384 | "Nenhuma mensagem vinculada... sincronizada ainda." | "Ainda não chegou mensagem deste contato. Converse pelo WhatsApp e ela aparece aqui." | "Abrir WhatsApp" |
| Plantões | light-duty-calendar.tsx:195-198 | "Nenhum plantão próximo" / "escala ativa" | "Você não tem plantão marcado" / "Quando o supervisor colocar você na escala, os horários aparecem aqui." | |
| Topo | light-availability-banner.tsx:27 | "Não foi possível atualizar a disponibilidade." | "Não deu para mudar seu status agora. Tente de novo em instantes." | |
| Configurações | broker-availability/components/light-availability-section.tsx:54 | `error.message` ou "Não foi possível salvar sua disponibilidade." | sempre "Não deu para salvar seus horários. Tente de novo em instantes." | |
| Configurações | connection-badge.tsx:69 | "Erro ao desconectar." | "Não deu para desconectar o WhatsApp. Tente de novo em instantes." | |
| Notificações | light-notifications.tsx:231 | "Não foi possível carregar mais notificações..." | "Não deu para trazer mais avisos. Toque em Carregar mais de novo." | |
| Notificações | light-lead-toast-toggle.tsx:33 | "Não foi possível salvar a preferência." | "Não deu para salvar esse aviso. Tente de novo." | |
| Notificações | supervisor-team-invites.tsx:28 | "Convites da equipe indisponíveis" / "estrutura de equipes" | "Convites ainda não chegaram" / "As equipes ainda não foram montadas. Fale com a gestão." | |
| Cotação | light-quote-simulator/summary-step.tsx:137 | "Nenhum lead demonstrativo encontrado." | "Nenhum lead com esse nome. Tente outro nome." | |
| Jornada | app/(dashboard)/jornada/page.tsx:23-24 | "Sua jornada está quase pronta" / "Não conseguimos carregar..." | "Seus pontos não abriram agora" / "Tente de novo em alguns minutos. Nada do que você fez se perdeu." | "Tentar de novo" |
| Mural | app/(dashboard)/relacionamento/page.tsx:66 | "A Central de relacionamento ainda não está ligada nesta empresa." | "Os recados da gestão ainda não estão ligados. Quando ligarem, eles aparecem aqui." | "Voltar ao início" |
| Mural | relationship/components/broker-mural.tsx:47 | `{error}` cru | "Não deu para marcar como lido. Tente de novo." | |

## Já bons (25)

Início (próxima ação, agenda), chat-screen, assistant-chat, scripts de lead em atendimento, fila (retornos, prazo em risco, busca), lead redistribuído, primeira mensagem (envio), clientes, plantão agora, notificações, disponibilidade (validação), cotação, Jornada (placares), mural vazio, ajuda e busca.
