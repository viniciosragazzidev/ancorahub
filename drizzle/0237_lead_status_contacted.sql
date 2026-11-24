-- Etapa "Entrei em contato" (24/11/2026): o corretor registra que fez o contato e conta como foi.
-- Fica entre "Em atendimento" (in_contact) e "Cotação enviada" (quote_sent). Aditiva: só acrescenta o valor ao enum;
-- nenhuma linha muda. O relato vai em lead_stage_history.reason e na linha do tempo (lead_interactions).
-- Plano: docs/implementations/active/2026-11-24-etapa-entrei-em-contato.md
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'contacted' AFTER 'in_contact';
