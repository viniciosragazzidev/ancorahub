# Catálogo de material das operadoras (2026-10-22)

Branch `feat/rag-catalogo-operadoras`. Pedido do Vinicios: deixar o RAG pronto para absorver todo o material de apoio da Amil (e depois de outras operadoras, como a Assim), catalogar cada informação por operadora, plano e área, atualizar só o que mudou e catalogar também as cotações (valores e promoções).

## Decisões (22/10)

| Tema | Decisão |
|---|---|
| Onde mora | Só no tenant da Âncora (catálogo privado: `tenant_private_carriers` e `tenant_private_plans`). Dá para promover ao catálogo global depois. |
| Revisão | Texto, regras, rede e carências entram sozinhos. Preço, plano novo, promoção e comissão esperam o diretor. |
| Busca por significado | OpenAI `text-embedding-3-small` (chave OpenAI). Sem chave, a busca por termo continua funcionando. |
| Cotações | Chegam em PDF de cotador. Os valores viram "preço observado", nunca substituem a tabela oficial. |

## Como funciona

1. **Entrada.** O diretor importa PDFs e imagens em Ferramentas › Materiais das operadoras (`/api/operator-materials/upload`). O material dos grupos de WhatsApp passa pela mesma ingestão (`operator-catalog/ingest.ts`). Para cada arquivo:
   - **Duplicado:** o hash MD5 identifica o arquivo repetido.
   - **Texto:** vem do PDF; PDF escaneado e imagem são lidos pela IA de visão.
   - **Vigência:** é detectada no texto.
   - **Publicação:** o documento e os trechos do RAG são publicados na hora, e o arquivo vai para a fila de catalogação (`catalog_status = pending`).
2. **Catalogação** (`operator-catalog/service.ts`, job a cada 5 min e disparo imediato após o upload).
   - **Leitura:** a IA lê o texto em janelas de 10 mil caracteres, até 12 por arquivo. Vai pelo gateway em modo sensível, só modelo pago.
   - **O que ela devolve:**
     - tipo do material, operadora, planos, vigência
     - tabelas de preço por faixa etária
     - fatos (área, campo, valor, condições, página)
     - sugestões de área ou campo novo
   - **Nomes:** operadora e planos são reconhecidos pelos nomes e apelidos já catalogados ("Amil S 380" = "S380"). Plano nunca visto é criado inativo e espera aprovação.
3. **Atualizar o mínimo** (`diff.ts`). Cada fato tem uma identidade: operadora + plano + área + campo + condições.
   - **Igual:** só marca "visto de novo" e passa a apontar para o material mais novo.
   - **Diferente:** fora das áreas com revisão, substitui (o antigo fica como `superseded`). Nas áreas com revisão, vira `pending_review` e o valor atual continua valendo até a aprovação.
   - **Sumiu na versão nova** do mesmo material (mesma operadora, tipo e assunto): sai do catálogo. Em preço e plano, espera o diretor ("Saíram da versão nova").
   - **Cotação:** grava em chave própria (`quote|...`) e aponta para o preço da tabela quando diverge.
4. **RAG.** O documento ganha `document_key` (operadora + tipo + assunto). A versão nova arquiva a anterior.
   - Os trechos recebem as tags de operadora, planos e áreas.
   - Trecho com o mesmo texto (hash) reaproveita o embedding já calculado, então só texto novo custa.
   - Cotações ficam fora das respostas (têm nome e idade de cliente). Os valores delas ficam no catálogo.
5. **Aprovação** (`review.ts`).
   - Aprovar preço de um plano ativo publica as tabelas internas de preço (`tenant_private_price_tables`): uma por conjunto de condições, com versão nova só quando algum preço mudou.
   - Aprovar uma sugestão cria a área ou o campo para todas as operadoras.
6. **Respostas** (`answer.ts`, Cotação Express no Assistente).
   - Operadora, plano e idades citados na pergunta filtram os fatos e os trechos.
   - A busca usa termo e significado ao mesmo tempo.
   - A IA responde só com o que recebeu, citando [F] para fato e [T] para trecho, com a vigência.

## Proteções: o material é a única fonte (22/10)

Pedido do Vinicios: se a informação não estiver no material importado, o sistema avisa em vez de responder. Implementado em `answer-guard.ts` e `answer.ts`.

1. **Operadora sem material:** a pergunta cita uma operadora do mercado que não está no catálogo. A resposta é "Ainda não há material da X importado", e a IA nem é chamada. Nomes que são palavra comum ("assim", "leve") ou nome de pessoa ("Alice") só contam com o nome completo.
2. **Só o que é relevante vai para a IA:** só entram fatos e trechos da operadora perguntada (trecho ainda não catalogado só entra se citar a operadora). O trecho também precisa estar perto da pergunta, por palavras ou por significado (distância até 0,55).
3. **Nada relevante:** o sistema responde "não encontrei no material importado; importe em Ferramentas" e não chama a IA.
4. **Na IA:** o prompt proíbe conhecimento próprio. A resposta vem como `found`/`missing`, com citação [F]/[T] em cada dado, e a IA não pode calcular valores que não estejam escritos. Com `found` falso, o corretor recebe a mensagem de não encontrado e o que faltou.
5. **Conferência da resposta:**
   - Resposta sem citação é bloqueada.
   - Citação de item que não foi enviado é bloqueada.
   - Qualquer número que não exista no material nem na pergunta é bloqueado. Isso pega valor inventado, conta feita pela IA e prazo trocado.
   - No lugar, o corretor recebe "Não consegui confirmar essa resposta no material importado".
6. **Todos os assistentes:** uma pergunta sobre operadora ou conteúdo de plano (operadora citada, carência, coparticipação, rede credenciada, reajuste, tabela de preço, mensalidade, reembolso, CPT, cobertura) feita ao Jack, aos outros assistentes do corretor, ao chat lateral ou ao chat geral é respondida só por esse fluxo, nunca pelo modelo livre. O chat geral (`/api/chat`) passou a exigir login.

Cada bloqueio fica no log como `[cotacao-express] blocked`, com o motivo.

## Áreas padrão

As áreas ficam no código (`taxonomy.ts`); as criadas a partir de sugestões ficam em `operator_catalog_areas`.

- Planos
- Tabela de preços
- Rede credenciada
- Carências
- Regras de aceitação
- Documentos exigidos
- Coparticipação
- Abrangência e região
- Promoções e campanhas
- Reajuste
- Comissionamento
- Regras de venda

## Banco

`drizzle/0213_operator_catalog.sql` (journal idx 159). **Precisa rodar antes do deploy**: as inserções em `knowledge_sources`, `knowledge_documents` e `knowledge_chunks` passam a citar as colunas novas.

- **Colunas novas:**
  - `knowledge_sources`: texto lido, status e resumo da catalogação, tipo, operadora
  - `knowledge_documents`: `document_key`, `superseded_by`
  - `knowledge_chunks`: `content_hash`
- **Tabelas novas:** `operator_catalog_areas`, `operator_catalog_suggestions`, `operator_catalog_facts`.

## Coolify

Tarefa nova: `/api/internal/jobs/operator-catalog`, a cada 5 minutos (ver `docs/runbooks/coolify-scheduled-tasks.md`). O material capturado antes do catálogo entra na fila sozinho.

## Como testar

1. Rodar a migration 0213 e fazer o deploy.
2. Ferramentas › Materiais das operadoras › Importar materiais: subir uma tabela PME da Amil e um manual.
3. Em até 5 minutos (ou na hora, pelo disparo após o upload), o arquivo passa de "Na fila" para "Catalogado" ou "Aguardando revisão". O drawer mostra o que foi lido por área.
4. Revisão: aprovar os planos novos e os preços. O Catálogo passa a mostrar a operadora com as áreas preenchidas.
5. Subir a mesma tabela de novo: deve aparecer "já foi importado". Subir uma versão com um preço alterado: só esse preço aparece em Revisão, o resto conta como "Iguais ao catálogo".
6. Assistente › Cotação Express: perguntar "carência de parto Amil" e "valor S380 para 35 anos". A resposta cita [F] ou [T] e a vigência.

## Pendências

- Os fatos aprovados ainda não alimentam o simulador de cotação do corretor (`quote-simulator`), que usa dados fictícios (`mock-data.ts`). Os dados já estão nas tabelas internas de preço para essa ligação.
- Áreas e campos novos entram com tipo texto. Mudar o tipo (valor, percentual) ainda não tem tela.
