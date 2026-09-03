# Isolamento e sincronização das conversas oficiais e Lite

**Data:** 2026-08-24  
**Estado:** implementado; liberação de ambiente pendente

> **Atualização 03/09:** a DEC-091 substitui o envio Lite por sincronização somente
> leitura. A conexão pessoal não autoriza mais contato oficial, cadência ou IA
> automática; apenas leads e clientes já atribuídos ao corretor podem ser persistidos.

## Objetivo

Separar a conversa oficial do tenant da conexão pessoal do corretor, mantendo a
supervisão operacional no mesmo histórico do lead e atualizando as duas telas
assim que a VPS persistir um evento WAHA.

## Contrato aplicado

- `/conversas` continua sendo a visão operacional do Diretor. Ela só recebe
  mensagens que pertencem a um lead do tenant; uma mensagem de conexão pessoal
  sem lead/cliente atribuído não é persistida.
- `/conversas/broker` é a central de insights da conexão do corretor. Um evento da
  sessão é autorizado somente quando o contato é um lead/cliente cujo `corretorId`
  é exatamente o usuário da sessão.
- Uma conversa corretor ↔ lead é gravada com o `leadId` já usado pela
  qualificação. Por isso, o Diretor a lê no mesmo chat, sem uma segunda thread
  e sem acesso às conversas pessoais do corretor.
- O webhook publica uma invalidação opaca `conversations` para o corretor
  participante e para os Diretores ativos do tenant. Nenhum telefone, nome ou
  conteúdo é publicado pelo Realtime; cada interface reconsulta o próprio
  escopo autenticado.
- A central completa escuta o mesmo evento que a tela Lite. O provider global
  não adia mais atualizações porque há um campo de texto em foco.
- No modo Lite, não existe envio pelo CRM. O corretor responde pelo seu WhatsApp;
  o canal Meta oficial permanece o transporte da operação do tenant e da gestão.
- O encaminhador Fastify da VPS assina o corpo encaminhado com
  `WAHA_RELAY_SHARED_SECRET` e os cabeçalhos `x-ancora-*` aceitos pelo webhook
  do CRM. Um Bearer interno isolado não satisfaz esse contrato e não é usado
  para essa entrega.

## Validação

- `npx vitest run src/features/waha-cadence/inbound.test.ts --pool=forks --maxWorkers=1`:
  4 testes aprovados, incluindo a barreira de conversa pessoal.
- `npx vitest run src/features/waha-cadence/contract.test.ts src/features/notifications/realtime-sync.test.ts src/features/broker-workspace/official-tenant-conversations.test.ts --pool=forks --maxWorkers=1`:
  9 testes aprovados, incluindo normalização de JID do WAHA.
- `services/whatsapp-api`: build TypeScript e suíte Node aprovados após o
  encaminhamento assinado (62 testes).
- `npm run agent:verify -- --level full`: documentação e segurança aprovadas;
  type-check global bloqueado por dívida anterior nas declarações de
  `react-aria-components` e encoding em `platform-admin/purge-job.ts`.

## Rollback

Reverter os arquivos deste recorte não altera schema nem apaga mensagens. Eventos
ignorados enquanto a barreira estiver ativa não são recuperáveis pelo CRM, pois
foram deliberadamente tratados como conversas pessoais fora do escopo.
