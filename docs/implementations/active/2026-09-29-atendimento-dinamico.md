# Atendimento dinâmico: conversa da qualificação e área "Atendimento"

Continuação de `2026-09-27-motor-atendimento.md` (DEC-126, DEC-127). Princípio: **o motor decide, a IA interpreta.** Ordem das perguntas, regras e ações são determinísticas; a IA só entende o que o cliente escreveu (e, na criação, sugere variações que alguém aprova). Nada chega ao cliente sem ter sido escrito ou aprovado pela equipe.

## Diagnóstico (conversa real, 2026-09-29)

- "Perfeito, Nome." fixo antes de toda pergunta.
- Pergunta de idade única ("idades dos beneficiários (ou média se for empresa)") mesmo para plano individual de 1 pessoa.
- Transferência pedia de novo nome e número de pessoas (texto salvo da empresa).
- Segundo "Falar com humano" ficava sem resposta (pausa de 10 min do mesmo modelo) e reabria a transferência.

## Fase A — conversa dinâmica (entregue em `fix/ia-qualificacao-dinamica`)

- `src/features/qualification-engine/reply-composer.ts` (puro, sem banco nem IA): confirma o valor respondido ("Itaboraí, ótimo."), resume várias respostas numa mensagem ("Anotei: familiar e 3 pessoas."), 2 a 3 formas por confirmação e por pergunta, nunca repete a abertura nem o nome da mensagem anterior, "Última pergunta:" no último campo, reformulação quando a pergunta não foi respondida, mesma semente = mesmo texto.
- Perguntas por contexto: individual → 1 pessoa (pula "quantas pessoas"); idade por número de pessoas e tipo de plano; empresa pergunta vidas e média de idade. As variações mantêm as palavras que a extração usa para ler respostas curtas.
- E-mail: "prefiro não informar" / "não tenho" encerra a pergunta (`EMAIL_DECLINED`, nunca salvo no lead).
- Dúvidas no meio da conversa: preço, operadoras, carência e "quem está falando" respondidas com texto revisado (`faq.*`, editável como resposta rápida), antes da resposta lateral por IA que já existia.
- Transferência com `{{nome}}` e `{{resumo}}`; variável vazia some com a pontuação. Novo padrão de "falar com humano" não pede dados já informados; o texto antigo salvo sem personalização é tratado como padrão aposentado e dá lugar ao novo no deploy, sem gravação no banco.
- Pedido repetido de humano com o atendimento já transferido: lembrete (limite existente de 2 a cada 30 min), sem nova transferência nem nova distribuição.
- Simulador (`/api/qualificacao/simulador`) roda o mesmo motor (extração, próxima pergunta, montador, respostas rápidas e dúvidas), sem enviar nem salvar.
- Verificação: 12 testes novos (inclui a conversa real de ponta a ponta), testes afetados atualizados; 122 testes do motor e 163 das áreas vizinhas; simulador conferido no servidor local.

Canal: as respostas da qualificação saem pelo canal da conversa, como antes.

## Próximas fases (plano aprovado em 2026-09-29)

Menu **Atendimento** com 5 seções, no padrão de densidade (tabela + painel lateral, busca + "+", um CTA por tela). Em tudo que envia, o canal é visível e escolhível: Meta oficial, WhatsApp da empresa (reserva Meta) ou mesmo canal da conversa, com validação por canal ao salvar e publicar.

| Fase | Entrega |
|---|---|
| B | Mensagens unificada (templates Meta, textos livres, variações), variável única `{{…}}`, prévia em balão, sugestão de variações por IA, validade por canal |
| C | Situações: junta Roteiros e respostas rápidas, frases de exemplo, ação (continuar, transferir, pausar), canal da resposta, "Teste uma frase" |
| D | Perguntas editáveis: ordem, variações, obrigatória/opcional, validação e regras de pular |
| E | Editor visual de fluxos (`@xyflow/react`) com canal por bloco, simulador, versões e validação ao publicar (tokens visuais aprovados antes) |
| F | Desempenho (funil por pergunta, situações, transferências, custo por canal) e retirada das telas antigas |

Referências usadas no desenho: Voiceflow e Typebot (editor, simulador, abandono por bloco), respond.io (pergunta com validação gravando no lead), Intercom e Zendesk (situações por frases de exemplo, testar antes de publicar), ManyChat e Kommo (gatilhos e resposta padrão), HubSpot (versões e teste com lead), Blip e Octadesk (padrões do WhatsApp no Brasil).

Decisões pendentes: nome e lugar do menu ("Atendimento"), retirada de `/fluxos-whatsapp` na fase F, tokens visuais do editor antes da fase E.
