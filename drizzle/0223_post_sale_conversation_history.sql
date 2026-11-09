-- Backfill accepted post-sale sends into the canonical history read by /conversas.
-- Safe to apply more than once. This file is intentionally not executed by code tasks.
WITH post_sale_rows AS (
  SELECT
    outbound.*,
    lead.id AS lead_id,
    CASE
      WHEN outbound.template_name = 'pos_venda_apresentacao'
        AND jsonb_typeof(outbound.variables) = 'array'
      THEN CASE
        WHEN jsonb_array_length(outbound.variables) >= 3
          AND NULLIF(BTRIM(outbound.variables ->> 0), '') IS NOT NULL
          AND NULLIF(BTRIM(outbound.variables ->> 1), '') IS NOT NULL
          AND NULLIF(BTRIM(outbound.variables ->> 2), '') IS NOT NULL
        THEN replace(
          replace(
            replace(
              'Olá, {{1}}! Aqui é da equipe de qualidade da {{2}}. Há alguns dias você falou com a gente sobre plano de saúde e o corretor {{3}} ficou responsável pelo seu atendimento. Queremos saber como foi a sua experiência para garantir que você seja bem atendido. Posso te fazer duas perguntas rápidas?',
              '{{1}}', BTRIM(outbound.variables ->> 0)
            ),
            '{{2}}', BTRIM(outbound.variables ->> 1)
          ),
          '{{3}}', BTRIM(outbound.variables ->> 2)
        )
      END
    END AS template_body
  FROM whatsapp_outbound_messages AS outbound
  JOIN leads AS lead
    ON lead.id = outbound.recipient_id
   AND lead.tenant_id = outbound.tenant_id
  WHERE outbound.purpose = 'postSaleSurvey'
    AND outbound.recipient_type = 'lead'
    AND outbound.sent_at IS NOT NULL
    AND outbound.status IN ('sent', 'delivered', 'read', 'failed')
), message_rows AS (
  SELECT *, COALESCE(NULLIF(BTRIM(rendered_body), ''), template_body) AS message_body
  FROM post_sale_rows
)
INSERT INTO whatsapp_messages (
  id,
  tenant_id,
  lead_id,
  communication_channel_id,
  waha_number_id,
  sender_role,
  provider,
  message_id,
  provider_status,
  phone,
  direction,
  body,
  sent_at
)
SELECT
  'post_sale_outbound_' || outbound.id,
  outbound.tenant_id,
  outbound.lead_id,
  outbound.channel_id,
  outbound.waha_number_id,
  'assistant',
  CASE WHEN outbound.delivery_route = 'waha_direct' THEN 'waha' ELSE 'meta_cloud' END,
  NULLIF(outbound.provider_message_id, 'wamid_sent'),  -- only reached when no row owns this id (WHERE below)
  outbound.status,
  outbound.destination_phone,
  'outbound',
  outbound.message_body,
  outbound.sent_at
FROM message_rows AS outbound
WHERE outbound.message_body IS NOT NULL
  -- The canonical message (webhook/echo) already carries this provider id: it is in the history, skip
  -- it so the conversation never shows the same send twice (Vigia, 09/11).
  AND NOT EXISTS (
    SELECT 1 FROM whatsapp_messages AS existing
    WHERE existing.tenant_id = outbound.tenant_id
      AND existing.message_id = NULLIF(outbound.provider_message_id, 'wamid_sent')
  )
ON CONFLICT DO NOTHING;
