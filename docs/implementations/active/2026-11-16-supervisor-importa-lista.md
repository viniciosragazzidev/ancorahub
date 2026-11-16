# Supervisor importa lista de contatos e distribui para a equipe (16/11/2026)

Status: **plano, aguardando aprovação**. Dono: Vinicios. Ideia de uma supervisora.

## O que é

Na página **Leads da equipe** do supervisor, um botão **Importar contatos** abre uma gaveta lateral em 3 passos:

1. **Colar ou enviar a lista**: até 50 contatos por vez.
2. **Conferir**: a lista volta organizada (nome, telefone, e-mail) e separada em prontos, repetidos e com problema.
3. **Distribuir**: quantos leads vão para cada corretor da equipe, ou para um grupo dividindo igualmente, como no plantão.

Os leads importados ficam **só daquela equipe**: entram sem dono, só o supervisor que importou e o diretor veem, e não
entram na distribuição automática nem no plantão.

## Como funciona hoje (o que muda)

| Ponto | Hoje | Com a mudança |
|---|---|---|
| Importar planilha | Só diretor (`importar_planilhas`). O botão aparece para o supervisor na tela clássica, mas o servidor recusa. | Ação nova só para o supervisor, limitada a 50 por vez e à equipe dele. |
| Lead sem dono | O supervisor não vê, porque a equipe é calculada pelo `corretorId`. | Coluna `supervisor_id` no lead: o lead sem dono importado pelo supervisor entra no escopo dele. |
| Atribuir lead | `assignLeadToBroker` só aceita diretor e gerente. O supervisor só repassa (`reassignLeadAction`, com `isInSupervisorTeam`). | Atribuição do supervisor no mesmo molde do repasse: só para corretor da equipe dele, origem `manual_supervisor`. |
| Distribuição em lote por quantidade | Não existe (só cota do plantão). | "Quantos para cada um", ou grupo dividindo igualmente. |

## Passo 1. Colar ou enviar a lista

- **Dois jeitos de entrar:** colar texto (do WhatsApp, Excel ou bloco de notas) ou enviar CSV/XLSX.
- **Leitura que organiza sozinha**, linha por linha:
  - e-mail pelo formato;
  - telefone pelos dígitos, normalizado com `lerTelefone` (celular BR com DDD; aceita +55, parênteses, traços e espaços);
  - o que sobra é o nome, com a primeira letra de cada palavra maiúscula.
  - Planilha com cabeçalho usa as colunas (nome, telefone/celular/whatsapp, email).
- **Limite:** 50 contatos por importação. Com mais de 50, a tela pega os 50 primeiros e avisa quantos ficaram para a próxima.
- **LGPD:** a mesma declaração do diretor ("Tenho autorização para contatar essas pessoas"), obrigatória.

## Passo 2. Conferir (antes de gravar qualquer coisa)

Tabela compacta com 3 grupos:

- **Prontos para importar.**
- **Repetidos:** o mesmo telefone já está no sistema ou aparece duas vezes na lista. Não importa e não mostra de quem é o lead.
- **Com problema:** telefone inválido, fixo ou sem nome. Dá para corrigir na própria linha.

Nada é gravado até o supervisor tocar em **Importar N contatos**.

## Passo 3. Distribuir

Depois de importar, a mesma gaveta pergunta para quem vão os leads:

- **Grupo dividindo igualmente** (padrão): escolhe os corretores da equipe (chips, com "Só ativos" ligado) e o sistema
  divide. Se não der conta exata, o resto vai um a mais para os primeiros da lista.
- **Quantidade por corretor:** um contador (−/+) por corretor. A soma não passa do total, e a tela mostra quantos
  sobram.
- **Deixar para depois:** o que não for distribuído fica em **Para distribuir**, um filtro novo na página da equipe,
  e pode ser distribuído depois com a mesma tela.

Ao distribuir:

- Cada lead vai direto para o corretor, com status distribuído, como na atribuição direta do diretor. O corretor
  recebe o aviso de lead novo de sempre.
- **Não** dispara mensagem automática para o cliente nem qualificação por IA: é contato frio, e o corretor faz o
  primeiro contato.
- Não conta para o rodízio nem para o limite do plantão.

## Regras de segurança

- Só supervisor, com a chave `feature_supervisor_lead_import_enabled` (começa desligada, por empresa).
- O servidor confere em toda chamada que cada corretor de destino está na equipe do supervisor (`isInSupervisorTeam`)
  e na mesma unidade.
- O supervisor só vê e distribui o que ele mesmo importou ou o que já é da equipe.
- Limite contra abuso: 50 por importação e 300 por dia por supervisor.
- Auditoria do lote (`supervisor_import.created`, `supervisor_import.distributed`) e de cada lead (`lead.assigned`
  com origem `manual_supervisor`).
- O diretor vê esses leads normalmente, com a origem "Lista da equipe de <supervisor>".

## Banco (migration 0232)

> Antes de criar, conferir o maior número em todas as branches do origin (hoje 0231).

- `leads.supervisor_id` (texto, nulo, indexado): quem importou. É o que coloca o lead sem dono no escopo do supervisor.
- `supervisor_lead_imports`: id, tenant, supervisor, unidade, total, importados, repetidos, inválidos, criado em.
- Valor `manual_supervisor` em `assignment_source`.
- Os leads: `origem: manual`, `source_channel: supervisor_import`, `source_metadata.importId`, `distribution_status: held`
  até distribuir.

## Arquivos

- `src/features/supervisor-workspace/lead-import/`:
  - `parse-contacts.ts`: leitura do texto e da planilha, puro e testado;
  - `actions.ts`: `previewSupervisorImport`, `importSupervisorContacts`, `distributeSupervisorLeads`;
  - `service.ts`: a atribuição do supervisor, no molde de `reassignLeadAction`;
  - `components/import-sheet.tsx`: gaveta de 3 passos.
- Escopo: `lead-authorization.ts`, `strict-role-scope.ts` e `conversations/lead-scope.ts` aceitam
  `corretorId IS NULL AND supervisor_id = eu`.
- `supervisor-leads-radar.tsx`: botão no `action` do `PeoplePage` e o filtro "Para distribuir".
- Chave no catálogo e no super-admin.
- `/dev/laboratorio`: fluxo "Importar lista" com servidor simulado.

## Design e feedback

- Gaveta (`Sheet`), com um único CTA primário por passo: "Conferir", "Importar N contatos", "Distribuir".
- Feedback (`FEEDBACK.md`):
  - importar = nível 1 (confirmação com o número);
  - distribuir = nível 2 (marco no contexto, "12 leads com a equipe");
  - sem som nem celebração.

## Testes

- Leitura da lista: formatos misturados, +55, fixo, e-mail no meio, repetidos, mais de 50.
- Escopo: o supervisor A não vê nem distribui leads do B; o corretor de fora da equipe é recusado.
- Divisão: igual com resto, quantidade por corretor, soma acima do total recusada.
- Atribuição: cria a tentativa, o evento, a auditoria e o aviso ao corretor, sem mensagem ao cliente.

## Ordem de entrega

1. Banco + escopo + leitura da lista (com testes).
2. Importar (passos 1 e 2) + filtro "Para distribuir".
3. Distribuir (passo 3) + aviso ao corretor.
4. Laboratório + chave no super-admin.
