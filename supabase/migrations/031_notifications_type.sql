-- Champ type pour différencier les notifications (ticket résolu vs nouveau ticket)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text;
