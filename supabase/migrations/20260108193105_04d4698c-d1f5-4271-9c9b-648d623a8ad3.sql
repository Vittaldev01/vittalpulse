-- Fase 1: Estrutura de Dados para Múltiplos Telefones

-- 1.1 Criar tabela contact_phones para armazenar múltiplos telefones por contato
CREATE TABLE public.contact_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  phone_type VARCHAR(20) DEFAULT 'unknown', -- whatsapp, landline, invalid, unknown
  is_primary BOOLEAN DEFAULT false,
  is_whatsapp BOOLEAN DEFAULT NULL, -- null = não validado, true = é whatsapp, false = não é
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_error TEXT,
  empresa_id UUID REFERENCES public.empresas(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contact_phones_contact_id ON public.contact_phones(contact_id);
CREATE INDEX idx_contact_phones_phone ON public.contact_phones(phone);
CREATE INDEX idx_contact_phones_empresa_id ON public.contact_phones(empresa_id);
CREATE INDEX idx_contact_phones_phone_type ON public.contact_phones(phone_type);

-- Enable RLS
ALTER TABLE public.contact_phones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own contact phones"
ON public.contact_phones FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN contact_lists cl ON c.list_id = cl.id
  WHERE c.id = contact_phones.contact_id AND cl.user_id = auth.uid()
));

CREATE POLICY "Users can insert own contact phones"
ON public.contact_phones FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM contacts c
  JOIN contact_lists cl ON c.list_id = cl.id
  WHERE c.id = contact_phones.contact_id AND cl.user_id = auth.uid()
));

CREATE POLICY "Users can update own contact phones"
ON public.contact_phones FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN contact_lists cl ON c.list_id = cl.id
  WHERE c.id = contact_phones.contact_id AND cl.user_id = auth.uid()
));

CREATE POLICY "Users can delete own contact phones"
ON public.contact_phones FOR DELETE
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN contact_lists cl ON c.list_id = cl.id
  WHERE c.id = contact_phones.contact_id AND cl.user_id = auth.uid()
));

CREATE POLICY "Admins can view all contact phones"
ON public.contact_phones FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert contact phones"
ON public.contact_phones FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update all contact phones"
ON public.contact_phones FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete contact phones"
ON public.contact_phones FOR DELETE
USING (is_admin(auth.uid()));

-- 1.2 Adicionar campos em campaign_messages para rastrear telefone usado
ALTER TABLE public.campaign_messages
ADD COLUMN IF NOT EXISTS phone_used VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_attempt INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS contact_phone_id UUID REFERENCES public.contact_phones(id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contact_phones_updated_at
BEFORE UPDATE ON public.contact_phones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();