# Conexão pessoal do Corretor: sincronização somente leitura

**Data:** 2026-09-03  
**Estado:** implementado localmente; homologação VPS pendente

## Objetivo

Usar a conexão pessoal do WhatsApp do Corretor apenas para trazer contexto de
atendimento da própria carteira ao CRM. A resposta continua no WhatsApp do
corretor; a conexão não pode ser usada pelo CRM para enviar mensagens, cadências
ou automações de IA.

## Implementação

- `/conversas/broker` passou de chat com compositor para **Central de insights**
  somente leitura. A tela contém carteira, marcos operacionais, leitura da IA,
  histórico sincronizado e atalho para abrir o WhatsApp.
- As Server Actions de envio recusam papel `broker` antes de qualquer seleção de
  transporte. Chamadas antigas, favoritos ou cliente desatualizado não conseguem
  enviar por essa sessão.
- O webhook da conexão pessoal aceita exclusivamente lead ou cliente do mesmo
  tenant cujo `corretorId` seja exatamente o usuário dono da sessão. Contato sem
  vínculo, lead sem responsável, número oficial e conversa interna são ignorados.
- Diretor e Gestor permanecem na central operacional existente. Quando abrem a
  conversa de um lead, a consulta é auditada sem gravar telefone, texto ou corpo
  de mensagens no evento de auditoria.
- O kill switch `feature_waha_connections_enabled` continua reversível: pausa a
  sincronização e a central sem excluir histórico ou desconectar sessões.

## Limites deliberados

- Nenhuma alteração foi feita no serviço WAHA, VPS, número corporativo ou fluxo
  de avisos internos do tenant.
- A central de insights não gera resposta sugerida nem dispara IA automaticamente;
  ela mostra somente análise já persistida para a conversa autorizada.
- A confirmação final requer QR real e observação de um inbound/outbound pelo
  celular do Corretor em ambiente homologado.

## Evidências de validação

- Lint dirigido para rota, componente, ações e inbound WAHA.
- Teste unitário dirigido de `src/features/waha-cadence/inbound.test.ts`.
- Type-check e build de produção devem ser registrados após a execução no checkout
  compartilhado, pois há mudanças paralelas ainda não publicadas.

## Rollback

Reverter os arquivos desta entrega ou desligar
`feature_waha_connections_enabled`. Não há migration, remoção de mensagem,
alteração de credencial ou alteração de infraestrutura.
