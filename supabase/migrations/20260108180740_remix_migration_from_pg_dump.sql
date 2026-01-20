CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user',
    'super_admin'
);


--
-- Name: check_empresa_limit(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_empresa_limit(_empresa_id uuid, _limit_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  empresa_record RECORD;
  usage_count INTEGER;
BEGIN
  SELECT * INTO empresa_record FROM empresas WHERE id = _empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Empresa não encontrada');
  END IF;
  IF empresa_record.status != 'ativo' AND empresa_record.status != 'trial' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Empresa suspensa ou cancelada');
  END IF;
  CASE _limit_type
    WHEN 'disparos' THEN
      IF empresa_record.disparos_usados_mes_atual >= empresa_record.limite_disparos_mensal THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Limite de disparos mensais atingido', 'limit', empresa_record.limite_disparos_mensal, 'used', empresa_record.disparos_usados_mes_atual);
      END IF;
    WHEN 'conexoes' THEN
      SELECT COUNT(*) INTO usage_count FROM whatsapp_connections WHERE empresa_id = _empresa_id;
      IF usage_count >= empresa_record.limite_conexoes THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Limite de conexões atingido', 'limit', empresa_record.limite_conexoes, 'used', usage_count);
      END IF;
    WHEN 'contatos' THEN
      SELECT COUNT(*) INTO usage_count FROM contacts WHERE empresa_id = _empresa_id;
      IF usage_count >= empresa_record.limite_contatos THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Limite de contatos atingido', 'limit', empresa_record.limite_contatos, 'used', usage_count);
      END IF;
    WHEN 'campanhas' THEN
      SELECT COUNT(*) INTO usage_count FROM campaigns WHERE empresa_id = _empresa_id AND status IN ('running', 'scheduled');
      IF usage_count >= empresa_record.limite_campanhas_simultaneas THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Limite de campanhas simultâneas atingido', 'limit', empresa_record.limite_campanhas_simultaneas, 'used', usage_count);
      END IF;
  END CASE;
  RETURN jsonb_build_object('allowed', true);
END;
$$;


--
-- Name: get_user_empresa_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_empresa_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT empresa_id
  FROM public.profiles
  WHERE id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    false
  );
  RETURN NEW;
END;
$$;


--
-- Name: increment_empresa_dispatch_counter(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_empresa_dispatch_counter() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    UPDATE empresas SET disparos_usados_mes_atual = disparos_usados_mes_atual + 1 WHERE id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: increment_sent_messages(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_sent_messages(campaign_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE campaigns
  SET sent_messages = sent_messages + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
END;
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;


--
-- Name: is_user_approved(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_user_approved(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT approved FROM public.profiles WHERE id = _user_id),
    false
  )
$$;


--
-- Name: reset_monthly_dispatch_counters(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_monthly_dispatch_counters() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO empresa_uso_historico (empresa_id, mes_referencia, disparos_total, conexoes_usadas, contatos_total, campanhas_criadas)
  SELECT e.id, DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE, e.disparos_usados_mes_atual,
    (SELECT COUNT(DISTINCT id) FROM whatsapp_connections WHERE empresa_id = e.id AND status = 'connected'),
    (SELECT COUNT(*) FROM contacts WHERE empresa_id = e.id),
    (SELECT COUNT(*) FROM campaigns WHERE empresa_id = e.id AND created_at >= e.ultimo_reset_contador)
  FROM empresas e WHERE e.data_renovacao <= CURRENT_DATE
  ON CONFLICT (empresa_id, mes_referencia) DO NOTHING;
  UPDATE empresas SET disparos_usados_mes_atual = 0, data_renovacao = data_renovacao + INTERVAL '30 days', ultimo_reset_contador = NOW()
  WHERE data_renovacao <= CURRENT_DATE;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: campaign_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaign_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    message_text text,
    part1_variation integer,
    part2_variation integer,
    media_url text,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    message_part integer DEFAULT 1,
    used_connection_id uuid,
    empresa_id uuid,
    CONSTRAINT campaign_messages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: campaign_processing_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_processing_lock (
    campaign_id uuid NOT NULL,
    locked_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_by text NOT NULL,
    process_type text NOT NULL,
    CONSTRAINT campaign_processing_lock_process_type_check CHECK ((process_type = ANY (ARRAY['campaign'::text, 'interactive'::text, 'followup'::text])))
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    connection_id uuid,
    list_id uuid,
    status text DEFAULT 'draft'::text,
    min_interval_seconds integer DEFAULT 30,
    max_interval_seconds integer DEFAULT 60,
    pause_after_messages integer DEFAULT 20,
    pause_duration_minutes integer DEFAULT 10,
    allowed_hours_start time without time zone,
    allowed_hours_end time without time zone,
    allowed_days jsonb,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    total_messages integer DEFAULT 0,
    sent_messages integer DEFAULT 0,
    failed_messages integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    messages jsonb,
    campaign_type text DEFAULT 'simple'::text,
    interaction_config jsonb DEFAULT '{"timeout_hours": 24, "delay_after_response_seconds": 10}'::jsonb,
    empresa_id uuid,
    next_batch_at timestamp with time zone,
    pause_reason text,
    CONSTRAINT campaigns_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['simple'::text, 'interactive'::text]))),
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'running'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: contact_custom_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_custom_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    contact_id uuid NOT NULL,
    field_id uuid NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contact_follow_up_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_follow_up_status (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    flow_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    current_step integer DEFAULT 1,
    is_active boolean DEFAULT true,
    last_message_sent_at timestamp with time zone,
    next_message_at timestamp with time zone,
    stopped_reason text,
    stopped_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid,
    CONSTRAINT contact_follow_up_status_stopped_reason_check CHECK ((stopped_reason = ANY (ARRAY['completed'::text, 'user_replied'::text, 'user_replied_m2'::text, 'manually_stopped'::text])))
);


--
-- Name: contact_interaction_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_interaction_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    current_stage text DEFAULT 'waiting_message1'::text NOT NULL,
    message1_sent_at timestamp with time zone,
    message1_response_received_at timestamp with time zone,
    message2_sent_at timestamp with time zone,
    message2_response_received_at timestamp with time zone,
    flow_completed boolean DEFAULT false,
    followup_started boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid,
    CONSTRAINT contact_interaction_status_current_stage_check CHECK ((current_stage = ANY (ARRAY['waiting_message1'::text, 'waiting_message1_response'::text, 'waiting_message1_response_via_followup'::text, 'waiting_message2'::text, 'waiting_message2_after_followup'::text, 'waiting_message2_response'::text, 'timeout_message1'::text, 'timeout_message2'::text, 'completed'::text, 'in_followup'::text])))
);


--
-- Name: contact_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_lists (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    total_contacts integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid
);


--
-- Name: contact_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_responses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    contact_id uuid NOT NULL,
    campaign_id uuid,
    phone text NOT NULL,
    message_text text,
    received_at timestamp with time zone DEFAULT now(),
    webhook_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    empresa_id uuid
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    list_id uuid NOT NULL,
    name text,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferred_connection_id uuid,
    empresa_id uuid,
    CONSTRAINT contacts_phone_required CHECK (((phone IS NOT NULL) AND (phone <> ''::text)))
);


--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_fields (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    list_id uuid NOT NULL,
    field_name text NOT NULL,
    field_type text DEFAULT 'text'::text,
    created_at timestamp with time zone DEFAULT now(),
    empresa_id uuid,
    CONSTRAINT custom_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text])))
);


--
-- Name: empresa_uso_historico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_uso_historico (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    mes_referencia date NOT NULL,
    disparos_total integer DEFAULT 0 NOT NULL,
    conexoes_usadas integer DEFAULT 0 NOT NULL,
    contatos_total integer DEFAULT 0 NOT NULL,
    campanhas_criadas integer DEFAULT 0 NOT NULL,
    disparos_simples integer DEFAULT 0 NOT NULL,
    disparos_interativos integer DEFAULT 0 NOT NULL,
    respostas_recebidas integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    email_contato text NOT NULL,
    telefone text,
    cnpj text,
    status text DEFAULT 'ativo'::text NOT NULL,
    plano_nome text DEFAULT 'basico'::text NOT NULL,
    limite_disparos_mensal integer DEFAULT 10000 NOT NULL,
    limite_conexoes integer DEFAULT 3 NOT NULL,
    limite_contatos integer DEFAULT 5000 NOT NULL,
    limite_campanhas_simultaneas integer DEFAULT 5 NOT NULL,
    disparos_usados_mes_atual integer DEFAULT 0 NOT NULL,
    data_renovacao date DEFAULT (CURRENT_DATE + '30 days'::interval) NOT NULL,
    ultimo_reset_contador timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    data_cancelamento timestamp with time zone,
    notas_internas text,
    features_habilitadas jsonb DEFAULT '{"follow_up": true, "ai_variations": false, "multi_conexao": true, "campanhas_interativas": true}'::jsonb,
    CONSTRAINT empresas_plano_nome_check CHECK ((plano_nome = ANY (ARRAY['basico'::text, 'profissional'::text, 'empresarial'::text, 'custom'::text]))),
    CONSTRAINT empresas_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'suspenso'::text, 'cancelado'::text, 'trial'::text])))
);


--
-- Name: follow_up_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_up_flows (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    total_steps integer,
    created_at timestamp with time zone DEFAULT now(),
    empresa_id uuid,
    CONSTRAINT follow_up_flows_total_steps_check CHECK (((total_steps >= 1) AND (total_steps <= 5)))
);


--
-- Name: follow_up_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_up_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    flow_id uuid NOT NULL,
    step_number integer NOT NULL,
    days_after_previous integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    messages jsonb,
    empresa_id uuid,
    CONSTRAINT follow_up_messages_step_number_check CHECK (((step_number >= 1) AND (step_number <= 5)))
);


--
-- Name: planos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    limite_disparos_mensal integer DEFAULT 10000 NOT NULL,
    limite_conexoes integer DEFAULT 3 NOT NULL,
    limite_contatos integer DEFAULT 5000 NOT NULL,
    limite_campanhas_simultaneas integer DEFAULT 5 NOT NULL,
    preco_mensal numeric(10,2),
    features_habilitadas jsonb DEFAULT '{"follow_up": true, "ai_variations": false, "multi_conexao": true, "campanhas_interativas": true}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approved boolean DEFAULT false NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    empresa_id uuid
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: webhooks_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooks_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    connection_id uuid,
    event_type text,
    payload jsonb,
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    empresa_id uuid
);


--
-- Name: whatsapp_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_connections (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    instance_id text,
    api_token text,
    status text DEFAULT 'pending'::text,
    qr_code text,
    phone_number text,
    connected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qr_endpoint_preference text DEFAULT 'auto'::text,
    last_error text,
    pairing_code text,
    pairing_code_expires_at timestamp with time zone,
    empresa_id uuid,
    CONSTRAINT whatsapp_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'pending'::text])))
);


--
-- Name: campaign_connections campaign_connections_campaign_id_connection_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_connections
    ADD CONSTRAINT campaign_connections_campaign_id_connection_id_key UNIQUE (campaign_id, connection_id);


--
-- Name: campaign_connections campaign_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_connections
    ADD CONSTRAINT campaign_connections_pkey PRIMARY KEY (id);


--
-- Name: campaign_messages campaign_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_pkey PRIMARY KEY (id);


--
-- Name: campaign_processing_lock campaign_processing_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processing_lock
    ADD CONSTRAINT campaign_processing_lock_pkey PRIMARY KEY (campaign_id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: contact_custom_data contact_custom_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_data
    ADD CONSTRAINT contact_custom_data_pkey PRIMARY KEY (id);


--
-- Name: contact_follow_up_status contact_follow_up_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_follow_up_status
    ADD CONSTRAINT contact_follow_up_status_pkey PRIMARY KEY (id);


--
-- Name: contact_interaction_status contact_interaction_status_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interaction_status
    ADD CONSTRAINT contact_interaction_status_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);


--
-- Name: contact_interaction_status contact_interaction_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interaction_status
    ADD CONSTRAINT contact_interaction_status_pkey PRIMARY KEY (id);


--
-- Name: contact_lists contact_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_lists
    ADD CONSTRAINT contact_lists_pkey PRIMARY KEY (id);


--
-- Name: contact_responses contact_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_responses
    ADD CONSTRAINT contact_responses_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: empresa_uso_historico empresa_uso_historico_empresa_id_mes_referencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_uso_historico
    ADD CONSTRAINT empresa_uso_historico_empresa_id_mes_referencia_key UNIQUE (empresa_id, mes_referencia);


--
-- Name: empresa_uso_historico empresa_uso_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_uso_historico
    ADD CONSTRAINT empresa_uso_historico_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: follow_up_flows follow_up_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_flows
    ADD CONSTRAINT follow_up_flows_pkey PRIMARY KEY (id);


--
-- Name: follow_up_messages follow_up_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_messages
    ADD CONSTRAINT follow_up_messages_pkey PRIMARY KEY (id);


--
-- Name: planos planos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planos
    ADD CONSTRAINT planos_nome_key UNIQUE (nome);


--
-- Name: planos planos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planos
    ADD CONSTRAINT planos_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: webhooks_log webhooks_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks_log
    ADD CONSTRAINT webhooks_log_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_connections whatsapp_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_pkey PRIMARY KEY (id);


--
-- Name: idx_campaign_messages_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_campaign_id ON public.campaign_messages USING btree (campaign_id);


--
-- Name: idx_campaign_messages_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_empresa_id ON public.campaign_messages USING btree (empresa_id);


--
-- Name: idx_campaign_messages_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_order ON public.campaign_messages USING btree (campaign_id, status, message_part, created_at);


--
-- Name: idx_campaign_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_status ON public.campaign_messages USING btree (status);


--
-- Name: idx_campaign_messages_used_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_used_connection ON public.campaign_messages USING btree (used_connection_id);


--
-- Name: idx_campaigns_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_empresa_id ON public.campaigns USING btree (empresa_id);


--
-- Name: idx_campaigns_next_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_next_batch ON public.campaigns USING btree (next_batch_at) WHERE (next_batch_at IS NOT NULL);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_campaigns_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_user_id ON public.campaigns USING btree (user_id);


--
-- Name: idx_contact_custom_data_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_custom_data_contact_id ON public.contact_custom_data USING btree (contact_id);


--
-- Name: idx_contact_custom_data_field_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_custom_data_field_id ON public.contact_custom_data USING btree (field_id);


--
-- Name: idx_contact_follow_up_status_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_follow_up_status_empresa_id ON public.contact_follow_up_status USING btree (empresa_id);


--
-- Name: idx_contact_follow_up_status_flow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_follow_up_status_flow_id ON public.contact_follow_up_status USING btree (flow_id);


--
-- Name: idx_contact_follow_up_status_next_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_follow_up_status_next_message ON public.contact_follow_up_status USING btree (next_message_at) WHERE (is_active = true);


--
-- Name: idx_contact_follow_up_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contact_follow_up_unique_active ON public.contact_follow_up_status USING btree (campaign_id, contact_id) WHERE (is_active = true);


--
-- Name: idx_contact_interaction_status_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_interaction_status_empresa_id ON public.contact_interaction_status USING btree (empresa_id);


--
-- Name: idx_contact_lists_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_lists_empresa_id ON public.contact_lists USING btree (empresa_id);


--
-- Name: idx_contact_responses_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_responses_contact_id ON public.contact_responses USING btree (contact_id);


--
-- Name: idx_contact_responses_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_responses_empresa_id ON public.contact_responses USING btree (empresa_id);


--
-- Name: idx_contacts_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_empresa_id ON public.contacts USING btree (empresa_id);


--
-- Name: idx_contacts_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_list_id ON public.contacts USING btree (list_id);


--
-- Name: idx_contacts_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_phone ON public.contacts USING btree (phone);


--
-- Name: idx_contacts_preferred_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_preferred_connection ON public.contacts USING btree (preferred_connection_id);


--
-- Name: idx_custom_fields_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_empresa_id ON public.custom_fields USING btree (empresa_id);


--
-- Name: idx_custom_fields_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_list_id ON public.custom_fields USING btree (list_id);


--
-- Name: idx_empresa_uso_historico_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_uso_historico_empresa ON public.empresa_uso_historico USING btree (empresa_id);


--
-- Name: idx_empresa_uso_historico_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresa_uso_historico_mes ON public.empresa_uso_historico USING btree (mes_referencia);


--
-- Name: idx_empresas_data_renovacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_data_renovacao ON public.empresas USING btree (data_renovacao);


--
-- Name: idx_empresas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_status ON public.empresas USING btree (status);


--
-- Name: idx_follow_up_flows_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_flows_campaign_id ON public.follow_up_flows USING btree (campaign_id);


--
-- Name: idx_follow_up_flows_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_flows_empresa_id ON public.follow_up_flows USING btree (empresa_id);


--
-- Name: idx_follow_up_messages_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_messages_empresa_id ON public.follow_up_messages USING btree (empresa_id);


--
-- Name: idx_interaction_status_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interaction_status_campaign ON public.contact_interaction_status USING btree (campaign_id);


--
-- Name: idx_interaction_status_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interaction_status_contact ON public.contact_interaction_status USING btree (contact_id);


--
-- Name: idx_interaction_status_message1_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interaction_status_message1_sent ON public.contact_interaction_status USING btree (message1_sent_at) WHERE (message1_sent_at IS NOT NULL);


--
-- Name: idx_interaction_status_message2_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interaction_status_message2_sent ON public.contact_interaction_status USING btree (message2_sent_at) WHERE (message2_sent_at IS NOT NULL);


--
-- Name: idx_interaction_status_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interaction_status_stage ON public.contact_interaction_status USING btree (current_stage);


--
-- Name: idx_lock_expired; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lock_expired ON public.campaign_processing_lock USING btree (locked_at);


--
-- Name: idx_profiles_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_empresa_id ON public.profiles USING btree (empresa_id);


--
-- Name: idx_webhooks_log_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhooks_log_empresa_id ON public.webhooks_log USING btree (empresa_id);


--
-- Name: idx_webhooks_log_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhooks_log_processed ON public.webhooks_log USING btree (processed) WHERE (processed = false);


--
-- Name: idx_whatsapp_connections_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_connections_empresa_id ON public.whatsapp_connections USING btree (empresa_id);


--
-- Name: campaign_messages trigger_increment_empresa_dispatch_counter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_increment_empresa_dispatch_counter AFTER UPDATE ON public.campaign_messages FOR EACH ROW EXECUTE FUNCTION public.increment_empresa_dispatch_counter();


--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_follow_up_status update_contact_follow_up_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_follow_up_status_updated_at BEFORE UPDATE ON public.contact_follow_up_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_lists update_contact_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON public.contact_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_interaction_status update_interaction_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_interaction_status_updated_at BEFORE UPDATE ON public.contact_interaction_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: planos update_planos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_connections update_whatsapp_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON public.whatsapp_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_connections campaign_connections_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_connections
    ADD CONSTRAINT campaign_connections_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_connections campaign_connections_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_connections
    ADD CONSTRAINT campaign_connections_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_used_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_used_connection_id_fkey FOREIGN KEY (used_connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;


--
-- Name: campaign_processing_lock campaign_processing_lock_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_processing_lock
    ADD CONSTRAINT campaign_processing_lock_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.contact_lists(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_custom_data contact_custom_data_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_data
    ADD CONSTRAINT contact_custom_data_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_custom_data contact_custom_data_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_data
    ADD CONSTRAINT contact_custom_data_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE;


--
-- Name: contact_follow_up_status contact_follow_up_status_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_follow_up_status
    ADD CONSTRAINT contact_follow_up_status_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: contact_follow_up_status contact_follow_up_status_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_follow_up_status
    ADD CONSTRAINT contact_follow_up_status_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_follow_up_status contact_follow_up_status_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_follow_up_status
    ADD CONSTRAINT contact_follow_up_status_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: contact_follow_up_status contact_follow_up_status_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_follow_up_status
    ADD CONSTRAINT contact_follow_up_status_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.follow_up_flows(id) ON DELETE CASCADE;


--
-- Name: contact_interaction_status contact_interaction_status_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interaction_status
    ADD CONSTRAINT contact_interaction_status_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: contact_interaction_status contact_interaction_status_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interaction_status
    ADD CONSTRAINT contact_interaction_status_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_interaction_status contact_interaction_status_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interaction_status
    ADD CONSTRAINT contact_interaction_status_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: contact_lists contact_lists_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_lists
    ADD CONSTRAINT contact_lists_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: contact_lists contact_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_lists
    ADD CONSTRAINT contact_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_responses contact_responses_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_responses
    ADD CONSTRAINT contact_responses_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: contact_responses contact_responses_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_responses
    ADD CONSTRAINT contact_responses_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_responses contact_responses_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_responses
    ADD CONSTRAINT contact_responses_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.contact_lists(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_preferred_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_preferred_connection_id_fkey FOREIGN KEY (preferred_connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;


--
-- Name: custom_fields custom_fields_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: custom_fields custom_fields_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.contact_lists(id) ON DELETE CASCADE;


--
-- Name: empresa_uso_historico empresa_uso_historico_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_uso_historico
    ADD CONSTRAINT empresa_uso_historico_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: follow_up_flows follow_up_flows_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_flows
    ADD CONSTRAINT follow_up_flows_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: follow_up_flows follow_up_flows_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_flows
    ADD CONSTRAINT follow_up_flows_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: follow_up_messages follow_up_messages_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_messages
    ADD CONSTRAINT follow_up_messages_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: follow_up_messages follow_up_messages_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_messages
    ADD CONSTRAINT follow_up_messages_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.follow_up_flows(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webhooks_log webhooks_log_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks_log
    ADD CONSTRAINT webhooks_log_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;


--
-- Name: webhooks_log webhooks_log_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks_log
    ADD CONSTRAINT webhooks_log_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: whatsapp_connections whatsapp_connections_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: whatsapp_connections whatsapp_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaigns Admins can delete all campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all campaigns" ON public.campaigns FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: whatsapp_connections Admins can delete all connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all connections" ON public.whatsapp_connections FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contacts Admins can delete all contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all contacts" ON public.contacts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: follow_up_flows Admins can delete all follow-up flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all follow-up flows" ON public.follow_up_flows FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_lists Admins can delete all lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all lists" ON public.contact_lists FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: campaign_connections Admins can delete campaign connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete campaign connections" ON public.campaign_connections FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_custom_data Admins can delete contact custom data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete contact custom data" ON public.contact_custom_data FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: custom_fields Admins can delete custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete custom fields" ON public.custom_fields FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: follow_up_messages Admins can delete follow-up messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete follow-up messages" ON public.follow_up_messages FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_interaction_status Admins can delete interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete interaction status" ON public.contact_interaction_status FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: campaign_connections Admins can insert campaign connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert campaign connections" ON public.campaign_connections FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: campaigns Admins can insert campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: whatsapp_connections Admins can insert connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert connections" ON public.whatsapp_connections FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contact_custom_data Admins can insert contact custom data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert contact custom data" ON public.contact_custom_data FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contacts Admins can insert contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: custom_fields Admins can insert custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert custom fields" ON public.custom_fields FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: follow_up_flows Admins can insert follow-up flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert follow-up flows" ON public.follow_up_flows FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: follow_up_messages Admins can insert follow-up messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert follow-up messages" ON public.follow_up_messages FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contact_follow_up_status Admins can insert follow-up status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert follow-up status" ON public.contact_follow_up_status FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contact_interaction_status Admins can insert interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert interaction status" ON public.contact_interaction_status FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contact_lists Admins can insert lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert lists" ON public.contact_lists FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: campaign_messages Admins can update all campaign messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all campaign messages" ON public.campaign_messages FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: campaigns Admins can update all campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: whatsapp_connections Admins can update all connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all connections" ON public.whatsapp_connections FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_custom_data Admins can update all contact custom data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all contact custom data" ON public.contact_custom_data FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contacts Admins can update all contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: follow_up_flows Admins can update all follow-up flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all follow-up flows" ON public.follow_up_flows FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_follow_up_status Admins can update all follow-up status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all follow-up status" ON public.contact_follow_up_status FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_interaction_status Admins can update all interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all interaction status" ON public.contact_interaction_status FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: contact_lists Admins can update all lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all lists" ON public.contact_lists FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: profiles Admins can update profiles for approval; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update profiles for approval" ON public.profiles FOR UPDATE TO authenticated USING ((public.is_admin(auth.uid()) OR (auth.uid() = id)));


--
-- Name: campaign_connections Admins can view all campaign connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all campaign connections" ON public.campaign_connections FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: campaign_messages Admins can view all campaign messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all campaign messages" ON public.campaign_messages FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: campaigns Admins can view all campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: whatsapp_connections Admins can view all connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all connections" ON public.whatsapp_connections FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_custom_data Admins can view all contact custom data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all contact custom data" ON public.contact_custom_data FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_responses Admins can view all contact responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all contact responses" ON public.contact_responses FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contacts Admins can view all contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all contacts" ON public.contacts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: custom_fields Admins can view all custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: follow_up_flows Admins can view all follow-up flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all follow-up flows" ON public.follow_up_flows FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: follow_up_messages Admins can view all follow-up messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all follow-up messages" ON public.follow_up_messages FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_follow_up_status Admins can view all follow-up status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all follow-up status" ON public.contact_follow_up_status FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_interaction_status Admins can view all interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all interaction status" ON public.contact_interaction_status FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((public.is_admin(auth.uid()) OR (auth.uid() = id)));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: webhooks_log Admins can view all webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all webhooks" ON public.webhooks_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: contact_lists Admins can view company lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view company lists" ON public.contact_lists FOR SELECT TO authenticated USING ((public.is_admin(auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid()))));


--
-- Name: campaigns Company admins can view company campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admins can view company campaigns" ON public.campaigns FOR SELECT USING ((public.is_admin(auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid()))));


--
-- Name: profiles Company admins can view company profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admins can view company profiles" ON public.profiles FOR SELECT USING ((public.is_admin(auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid()))));


--
-- Name: empresa_uso_historico Company admins can view own company usage history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company admins can view own company usage history" ON public.empresa_uso_historico FOR SELECT USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: whatsapp_connections Company users can delete company connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can delete company connections" ON public.whatsapp_connections FOR DELETE USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: contact_lists Company users can delete company lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can delete company lists" ON public.contact_lists FOR DELETE USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: whatsapp_connections Company users can insert company connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can insert company connections" ON public.whatsapp_connections FOR INSERT WITH CHECK ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: contact_lists Company users can insert company lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can insert company lists" ON public.contact_lists FOR INSERT WITH CHECK ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: whatsapp_connections Company users can update company connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can update company connections" ON public.whatsapp_connections FOR UPDATE USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: contact_lists Company users can update company lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can update company lists" ON public.contact_lists FOR UPDATE USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: whatsapp_connections Company users can view company connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can view company connections" ON public.whatsapp_connections FOR SELECT USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: contact_lists Company users can view company lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company users can view company lists" ON public.contact_lists FOR SELECT TO authenticated USING ((empresa_id = public.get_user_empresa_id(auth.uid())));


--
-- Name: planos Everyone can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active plans" ON public.planos FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: campaign_processing_lock Service role can manage locks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage locks" ON public.campaign_processing_lock USING (true) WITH CHECK (true);


--
-- Name: empresas Super admins can manage companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage companies" ON public.empresas USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: planos Super admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage plans" ON public.planos TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: campaigns Super admins can view all campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all campaigns" ON public.campaigns FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: empresas Super admins can view all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all companies" ON public.empresas FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: whatsapp_connections Super admins can view all connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all connections" ON public.whatsapp_connections FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: contact_lists Super admins can view all contact lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all contact lists" ON public.contact_lists FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: profiles Super admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: user_roles Super admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: empresa_uso_historico Super admins can view all usage history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all usage history" ON public.empresa_uso_historico FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: campaign_connections Users can delete own campaign connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own campaign connections" ON public.campaign_connections FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_connections.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: campaigns Users can delete own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: campaigns Users can delete own company campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own company campaigns" ON public.campaigns FOR DELETE USING ((public.is_super_admin(auth.uid()) OR ((user_id = auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid())))));


--
-- Name: whatsapp_connections Users can delete own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own connections" ON public.whatsapp_connections FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: contact_custom_data Users can delete own contact data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own contact data" ON public.contact_custom_data FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.contact_lists cl ON ((c.list_id = cl.id)))
  WHERE ((c.id = contact_custom_data.contact_id) AND (cl.user_id = auth.uid())))));


--
-- Name: contacts Users can delete own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = contacts.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: custom_fields Users can delete own custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own custom fields" ON public.custom_fields FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = custom_fields.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: follow_up_flows Users can delete own flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own flows" ON public.follow_up_flows FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = follow_up_flows.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: follow_up_messages Users can delete own follow-up messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own follow-up messages" ON public.follow_up_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.follow_up_flows ff
     JOIN public.campaigns c ON ((ff.campaign_id = c.id)))
  WHERE ((ff.id = follow_up_messages.flow_id) AND (c.user_id = auth.uid())))));


--
-- Name: contact_lists Users can delete own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lists" ON public.contact_lists FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: campaign_connections Users can insert own campaign connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own campaign connections" ON public.campaign_connections FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_connections.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: campaign_messages Users can insert own campaign messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own campaign messages" ON public.campaign_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_messages.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: campaigns Users can insert own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: campaigns Users can insert own company campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own company campaigns" ON public.campaigns FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid()))));


--
-- Name: whatsapp_connections Users can insert own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own connections" ON public.whatsapp_connections FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: contact_custom_data Users can insert own contact data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own contact data" ON public.contact_custom_data FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.contact_lists cl ON ((c.list_id = cl.id)))
  WHERE ((c.id = contact_custom_data.contact_id) AND (cl.user_id = auth.uid())))));


--
-- Name: contacts Users can insert own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own contacts" ON public.contacts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = contacts.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: custom_fields Users can insert own custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own custom fields" ON public.custom_fields FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = custom_fields.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: follow_up_flows Users can insert own flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own flows" ON public.follow_up_flows FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = follow_up_flows.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: follow_up_messages Users can insert own follow-up messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own follow-up messages" ON public.follow_up_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.follow_up_flows ff
     JOIN public.campaigns c ON ((ff.campaign_id = c.id)))
  WHERE ((ff.id = follow_up_messages.flow_id) AND (c.user_id = auth.uid())))));


--
-- Name: contact_follow_up_status Users can insert own follow-up status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own follow-up status" ON public.contact_follow_up_status FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.follow_up_flows ff
     JOIN public.campaigns c ON ((ff.campaign_id = c.id)))
  WHERE ((ff.id = contact_follow_up_status.flow_id) AND (c.user_id = auth.uid())))));


--
-- Name: contact_interaction_status Users can insert own interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own interaction status" ON public.contact_interaction_status FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = contact_interaction_status.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: contact_lists Users can insert own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own lists" ON public.contact_lists FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: contact_responses Users can insert responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert responses" ON public.contact_responses FOR INSERT WITH CHECK (true);


--
-- Name: campaign_messages Users can update own campaign messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own campaign messages" ON public.campaign_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_messages.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: campaigns Users can update own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: campaigns Users can update own company campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own company campaigns" ON public.campaigns FOR UPDATE USING ((public.is_super_admin(auth.uid()) OR ((user_id = auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid())))));


--
-- Name: whatsapp_connections Users can update own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own connections" ON public.whatsapp_connections FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: contact_custom_data Users can update own contact data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own contact data" ON public.contact_custom_data FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.contact_lists cl ON ((c.list_id = cl.id)))
  WHERE ((c.id = contact_custom_data.contact_id) AND (cl.user_id = auth.uid())))));


--
-- Name: contacts Users can update own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = contacts.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: follow_up_flows Users can update own flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own flows" ON public.follow_up_flows FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = follow_up_flows.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: contact_follow_up_status Users can update own follow-up status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own follow-up status" ON public.contact_follow_up_status FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.follow_up_flows ff
     JOIN public.campaigns c ON ((ff.campaign_id = c.id)))
  WHERE ((ff.id = contact_follow_up_status.flow_id) AND (c.user_id = auth.uid())))));


--
-- Name: contact_interaction_status Users can update own interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own interaction status" ON public.contact_interaction_status FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = contact_interaction_status.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: contact_lists Users can update own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lists" ON public.contact_lists FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: campaign_connections Users can view own campaign connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own campaign connections" ON public.campaign_connections FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_connections.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: campaign_messages Users can view own campaign messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own campaign messages" ON public.campaign_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = campaign_messages.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: campaigns Users can view own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: empresas Users can view own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own company" ON public.empresas FOR SELECT TO authenticated USING ((id = ( SELECT profiles.empresa_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: campaigns Users can view own company campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own company campaigns" ON public.campaigns FOR SELECT USING (((user_id = auth.uid()) AND (empresa_id = public.get_user_empresa_id(auth.uid()))));


--
-- Name: whatsapp_connections Users can view own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own connections" ON public.whatsapp_connections FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contact_custom_data Users can view own contact data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own contact data" ON public.contact_custom_data FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.contact_lists cl ON ((c.list_id = cl.id)))
  WHERE ((c.id = contact_custom_data.contact_id) AND (cl.user_id = auth.uid())))));


--
-- Name: contacts Users can view own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own contacts" ON public.contacts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = contacts.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: custom_fields Users can view own custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own custom fields" ON public.custom_fields FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.contact_lists
  WHERE ((contact_lists.id = custom_fields.list_id) AND (contact_lists.user_id = auth.uid())))));


--
-- Name: follow_up_flows Users can view own flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own flows" ON public.follow_up_flows FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = follow_up_flows.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: follow_up_messages Users can view own follow-up messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own follow-up messages" ON public.follow_up_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.follow_up_flows ff
     JOIN public.campaigns c ON ((ff.campaign_id = c.id)))
  WHERE ((ff.id = follow_up_messages.flow_id) AND (c.user_id = auth.uid())))));


--
-- Name: contact_follow_up_status Users can view own follow-up status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own follow-up status" ON public.contact_follow_up_status FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.follow_up_flows ff
     JOIN public.campaigns c ON ((ff.campaign_id = c.id)))
  WHERE ((ff.id = contact_follow_up_status.flow_id) AND (c.user_id = auth.uid())))));


--
-- Name: contact_interaction_status Users can view own interaction status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own interaction status" ON public.contact_interaction_status FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.campaigns
  WHERE ((campaigns.id = contact_interaction_status.campaign_id) AND (campaigns.user_id = auth.uid())))));


--
-- Name: contact_lists Users can view own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own lists" ON public.contact_lists FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: contact_responses Users can view own responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own responses" ON public.contact_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.contact_lists cl ON ((c.list_id = cl.id)))
  WHERE ((c.id = contact_responses.contact_id) AND (cl.user_id = auth.uid())))));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: webhooks_log Users can view own webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own webhooks" ON public.webhooks_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_connections
  WHERE ((whatsapp_connections.id = webhooks_log.connection_id) AND (whatsapp_connections.user_id = auth.uid())))));


--
-- Name: campaign_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_processing_lock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_processing_lock ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_custom_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_custom_data ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_follow_up_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_follow_up_status ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_interaction_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_interaction_status ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: empresa_uso_historico; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresa_uso_historico ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_up_flows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_up_flows ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_up_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_up_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: planos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: webhooks_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhooks_log ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;