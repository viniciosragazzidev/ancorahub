-- Migration 0138: Suporte a capabilities brokerFallback e qualificationFallback em waha_numbers
COMMENT ON COLUMN "waha_numbers"."capabilities" IS 'Suporta inbound, cadence, ai, brokerFallback e qualificationFallback';
