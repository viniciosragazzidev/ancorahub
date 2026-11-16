-- Lista interna da equipe (16/11/2026): lead importado pela supervisão JAMAIS entra na fila de distribuição geral
-- da corretora. Qualquer caminho que tente colocá-lo na fila (devolução, recusa, recuperação, corretor desligado,
-- requalificação) faz o lead voltar para a lista do supervisor ("Para distribuir"), sem fila.
CREATE OR REPLACE FUNCTION leads_team_list_never_queued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source_channel = 'supervisor_import'
    AND (NEW.queue_id IS NOT NULL OR NEW.distribution_status IN ('queued', 'unassigned', 'returned_to_queue', 'awaiting_unit', 'assigning', 'distribution_failed')) THEN
    NEW.queue_id := NULL;
    IF NEW.corretor_id IS NULL THEN
      NEW.distribution_status := 'manual_hold';
    ELSIF NEW.distribution_status <> 'assigned' THEN
      NEW.distribution_status := 'assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS leads_team_list_never_queued ON leads;
--> statement-breakpoint
CREATE TRIGGER leads_team_list_never_queued
  BEFORE INSERT OR UPDATE OF distribution_status, queue_id, corretor_id, source_channel ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_team_list_never_queued();
