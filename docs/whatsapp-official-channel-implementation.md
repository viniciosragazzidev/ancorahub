# WhatsApp oficial corporativo

## Escopo entregue

O CorreTop mantém um único canal oficial de WhatsApp por tenant, pertencente à
matriz. A conexão continua sendo feita pelo Embedded Signup já existente; a
interface de unidades não cria canais por filial nesta fase. O banco permanece
compatível com canais por filial para uma decisão futura, mas a ação do servidor
rejeita `branchId` quando uma nova conexão é solicitada.

Segredos ficam exclusivamente em `communication_channels.access_token_ciphertext`.
O token é cifrado antes da persistência e nunca é retornado, registrado ou aceito
em payload de navegador.

## Entregas técnicas

- `drizzle/0070_whatsapp_official_channel_outbox.sql` cria a restrição de um
  canal corporativo ativo padrão e o ledger `whatsapp_outbound_messages`.
- `enqueueMetaTemplateMessage` valida telefone internacional, finalidade,
  variáveis e idempotência por tenant; só usa canal ativo corporativo.
- `sendMetaCloudTemplate` envia apenas modelos aprovados pelo catálogo interno.
- `/api/internal/jobs/whatsapp` processa lotes pequenos com limite, tentativas,
  backoff e mensagens de erro seguras. O cron diário é apenas recuperação de
  contingência no Vercel Hobby; processamento frequente exige worker/cron externo.
- O webhook Meta atualiza estados de entrega sem confiar em tenant enviado pela
  Meta: primeiro resolve o `phone_number_id` associado ao canal.
- Operações de conexão, ativação/desativação e enfileiramento geram auditoria.

## Dependências e pendências

1. Cadastrar na Meta os modelos com os nomes do catálogo antes de enviar produção.
2. Criar um worker persistente (ou Vercel Pro/serviço externo) para processar a
   fila em intervalo inferior ao cron diário.
3. Adicionar a superfície administrativa de histórico/teste e o fluxo de convite
   de corretor depois que os modelos forem aprovados.
4. Definir retenção e opt-out com Jurídico antes de ativar mensagens recorrentes.

## Operação segura

Nunca coloque `META_WHATSAPP_APP_SECRET`, `META_WHATSAPP_TOKEN_ENCRYPTION_KEY`
ou tokens de canal em `NEXT_PUBLIC_*`, banco sem criptografia, logs ou respostas
de API. Toda reexecução deve reutilizar a mesma chave de idempotência.
