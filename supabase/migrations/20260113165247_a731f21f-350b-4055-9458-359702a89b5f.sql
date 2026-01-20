-- Adicionar coluna para rastrear quando mensagem entrou em processing
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;