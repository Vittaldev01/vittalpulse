export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_connections: {
        Row: {
          campaign_id: string
          connection_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          campaign_id: string
          connection_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          campaign_id?: string
          connection_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_connections_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          contact_id: string
          contact_phone_id: string | null
          created_at: string | null
          empresa_id: string | null
          error_message: string | null
          id: string
          media_items: Json | null
          media_url: string | null
          message_part: number | null
          message_text: string | null
          part1_variation: number | null
          part2_variation: number | null
          phone_attempt: number | null
          phone_used: string | null
          processing_started_at: string | null
          sent_at: string | null
          status: string | null
          used_connection_id: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          contact_phone_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          error_message?: string | null
          id?: string
          media_items?: Json | null
          media_url?: string | null
          message_part?: number | null
          message_text?: string | null
          part1_variation?: number | null
          part2_variation?: number | null
          phone_attempt?: number | null
          phone_used?: string | null
          processing_started_at?: string | null
          sent_at?: string | null
          status?: string | null
          used_connection_id?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          contact_phone_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          error_message?: string | null
          id?: string
          media_items?: Json | null
          media_url?: string | null
          message_part?: number | null
          message_text?: string | null
          part1_variation?: number | null
          part2_variation?: number | null
          phone_attempt?: number | null
          phone_used?: string | null
          processing_started_at?: string | null
          sent_at?: string | null
          status?: string | null
          used_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_phone_id_fkey"
            columns: ["contact_phone_id"]
            isOneToOne: false
            referencedRelation: "contact_phones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_used_connection_id_fkey"
            columns: ["used_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_processing_lock: {
        Row: {
          campaign_id: string
          locked_at: string
          locked_by: string
          process_type: string
        }
        Insert: {
          campaign_id: string
          locked_at?: string
          locked_by: string
          process_type: string
        }
        Update: {
          campaign_id?: string
          locked_at?: string
          locked_by?: string
          process_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_processing_lock_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          allowed_days: Json | null
          allowed_hours_end: string | null
          allowed_hours_start: string | null
          campaign_type: string | null
          completed_at: string | null
          connection_id: string | null
          created_at: string | null
          empresa_id: string | null
          failed_messages: number | null
          id: string
          interaction_config: Json | null
          list_id: string | null
          max_interval_seconds: number | null
          messages: Json | null
          min_interval_seconds: number | null
          name: string
          next_batch_at: string | null
          pause_after_messages: number | null
          pause_duration_minutes: number | null
          pause_reason: string | null
          scheduled_at: string | null
          sent_messages: number | null
          started_at: string | null
          status: string | null
          total_messages: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_days?: Json | null
          allowed_hours_end?: string | null
          allowed_hours_start?: string | null
          campaign_type?: string | null
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          failed_messages?: number | null
          id?: string
          interaction_config?: Json | null
          list_id?: string | null
          max_interval_seconds?: number | null
          messages?: Json | null
          min_interval_seconds?: number | null
          name: string
          next_batch_at?: string | null
          pause_after_messages?: number | null
          pause_duration_minutes?: number | null
          pause_reason?: string | null
          scheduled_at?: string | null
          sent_messages?: number | null
          started_at?: string | null
          status?: string | null
          total_messages?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_days?: Json | null
          allowed_hours_end?: string | null
          allowed_hours_start?: string | null
          campaign_type?: string | null
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          failed_messages?: number | null
          id?: string
          interaction_config?: Json | null
          list_id?: string | null
          max_interval_seconds?: number | null
          messages?: Json | null
          min_interval_seconds?: number | null
          name?: string
          next_batch_at?: string | null
          pause_after_messages?: number | null
          pause_duration_minutes?: number | null
          pause_reason?: string | null
          scheduled_at?: string | null
          sent_messages?: number | null
          started_at?: string | null
          status?: string | null
          total_messages?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_data: {
        Row: {
          contact_id: string
          created_at: string | null
          field_id: string
          id: string
          value: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          field_id: string
          id?: string
          value?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          field_id?: string
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_data_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_custom_data_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_follow_up_status: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          current_step: number | null
          empresa_id: string | null
          flow_id: string
          id: string
          is_active: boolean | null
          last_message_sent_at: string | null
          next_message_at: string | null
          stopped_at: string | null
          stopped_reason: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          current_step?: number | null
          empresa_id?: string | null
          flow_id: string
          id?: string
          is_active?: boolean | null
          last_message_sent_at?: string | null
          next_message_at?: string | null
          stopped_at?: string | null
          stopped_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          current_step?: number | null
          empresa_id?: string | null
          flow_id?: string
          id?: string
          is_active?: boolean | null
          last_message_sent_at?: string | null
          next_message_at?: string | null
          stopped_at?: string | null
          stopped_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_follow_up_status_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_follow_up_status_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_follow_up_status_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_follow_up_status_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "follow_up_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_interaction_status: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          current_stage: string
          empresa_id: string | null
          flow_completed: boolean | null
          followup_started: boolean | null
          id: string
          message1_response_received_at: string | null
          message1_sent_at: string | null
          message2_response_received_at: string | null
          message2_sent_at: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          current_stage?: string
          empresa_id?: string | null
          flow_completed?: boolean | null
          followup_started?: boolean | null
          id?: string
          message1_response_received_at?: string | null
          message1_sent_at?: string | null
          message2_response_received_at?: string | null
          message2_sent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          current_stage?: string
          empresa_id?: string | null
          flow_completed?: boolean | null
          followup_started?: boolean | null
          id?: string
          message1_response_received_at?: string | null
          message1_sent_at?: string | null
          message2_response_received_at?: string | null
          message2_sent_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_interaction_status_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interaction_status_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interaction_status_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string | null
          description: string | null
          empresa_id: string | null
          id: string
          name: string
          total_contacts: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          empresa_id?: string | null
          id?: string
          name: string
          total_contacts?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          empresa_id?: string | null
          id?: string
          name?: string
          total_contacts?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: string
          created_at: string | null
          empresa_id: string | null
          id: string
          is_primary: boolean | null
          is_whatsapp: boolean | null
          phone: string
          phone_type: string | null
          updated_at: string | null
          validated_at: string | null
          validation_error: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          is_primary?: boolean | null
          is_whatsapp?: boolean | null
          phone: string
          phone_type?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validation_error?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          is_primary?: boolean | null
          is_whatsapp?: boolean | null
          phone?: string
          phone_type?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validation_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_phones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_responses: {
        Row: {
          campaign_id: string | null
          contact_id: string
          created_at: string | null
          empresa_id: string | null
          id: string
          message_text: string | null
          phone: string
          received_at: string | null
          webhook_data: Json | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          message_text?: string | null
          phone: string
          received_at?: string | null
          webhook_data?: Json | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          message_text?: string | null
          phone?: string
          received_at?: string | null
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_responses_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          list_id: string
          name: string | null
          phone: string
          preferred_connection_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          list_id: string
          name?: string | null
          phone: string
          preferred_connection_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          list_id?: string
          name?: string | null
          phone?: string
          preferred_connection_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_preferred_connection_id_fkey"
            columns: ["preferred_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          field_name: string
          field_type: string | null
          id: string
          list_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          field_name: string
          field_type?: string | null
          id?: string
          list_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          field_name?: string
          field_type?: string | null
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_uso_historico: {
        Row: {
          campanhas_criadas: number
          conexoes_usadas: number
          contatos_total: number
          created_at: string | null
          disparos_interativos: number
          disparos_simples: number
          disparos_total: number
          empresa_id: string
          id: string
          mes_referencia: string
          respostas_recebidas: number
        }
        Insert: {
          campanhas_criadas?: number
          conexoes_usadas?: number
          contatos_total?: number
          created_at?: string | null
          disparos_interativos?: number
          disparos_simples?: number
          disparos_total?: number
          empresa_id: string
          id?: string
          mes_referencia: string
          respostas_recebidas?: number
        }
        Update: {
          campanhas_criadas?: number
          conexoes_usadas?: number
          contatos_total?: number
          created_at?: string | null
          disparos_interativos?: number
          disparos_simples?: number
          disparos_total?: number
          empresa_id?: string
          id?: string
          mes_referencia?: string
          respostas_recebidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_uso_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string | null
          data_cancelamento: string | null
          data_renovacao: string
          disparos_usados_mes_atual: number
          email_contato: string
          features_habilitadas: Json | null
          id: string
          limite_campanhas_simultaneas: number
          limite_conexoes: number
          limite_contatos: number
          limite_disparos_mensal: number
          nome: string
          notas_internas: string | null
          plano_nome: string
          status: string
          telefone: string | null
          ultimo_reset_contador: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          data_cancelamento?: string | null
          data_renovacao?: string
          disparos_usados_mes_atual?: number
          email_contato: string
          features_habilitadas?: Json | null
          id?: string
          limite_campanhas_simultaneas?: number
          limite_conexoes?: number
          limite_contatos?: number
          limite_disparos_mensal?: number
          nome: string
          notas_internas?: string | null
          plano_nome?: string
          status?: string
          telefone?: string | null
          ultimo_reset_contador?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          data_cancelamento?: string | null
          data_renovacao?: string
          disparos_usados_mes_atual?: number
          email_contato?: string
          features_habilitadas?: Json | null
          id?: string
          limite_campanhas_simultaneas?: number
          limite_conexoes?: number
          limite_contatos?: number
          limite_disparos_mensal?: number
          nome?: string
          notas_internas?: string | null
          plano_nome?: string
          status?: string
          telefone?: string | null
          ultimo_reset_contador?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      follow_up_flows: {
        Row: {
          campaign_id: string
          created_at: string | null
          empresa_id: string | null
          id: string
          is_active: boolean | null
          total_steps: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          is_active?: boolean | null
          total_steps?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          is_active?: boolean | null
          total_steps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_flows_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_flows_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_messages: {
        Row: {
          created_at: string | null
          days_after_previous: number
          empresa_id: string | null
          flow_id: string
          id: string
          messages: Json | null
          step_number: number
        }
        Insert: {
          created_at?: string | null
          days_after_previous: number
          empresa_id?: string | null
          flow_id: string
          id?: string
          messages?: Json | null
          step_number: number
        }
        Update: {
          created_at?: string | null
          days_after_previous?: number
          empresa_id?: string | null
          flow_id?: string
          id?: string
          messages?: Json | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_messages_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_messages_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "follow_up_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          created_at: string | null
          descricao: string | null
          features_habilitadas: Json | null
          id: string
          is_active: boolean | null
          limite_campanhas_simultaneas: number
          limite_conexoes: number
          limite_contatos: number
          limite_disparos_mensal: number
          nome: string
          preco_mensal: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          features_habilitadas?: Json | null
          id?: string
          is_active?: boolean | null
          limite_campanhas_simultaneas?: number
          limite_conexoes?: number
          limite_contatos?: number
          limite_disparos_mensal?: number
          nome: string
          preco_mensal?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          features_habilitadas?: Json | null
          id?: string
          is_active?: boolean | null
          limite_campanhas_simultaneas?: number
          limite_conexoes?: number
          limite_contatos?: number
          limite_disparos_mensal?: number
          nome?: string
          preco_mensal?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          empresa_id: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhooks_log: {
        Row: {
          connection_id: string | null
          created_at: string | null
          empresa_id: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          api_token: string | null
          connected_at: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          instance_id: string | null
          last_error: string | null
          name: string
          pairing_code: string | null
          pairing_code_expires_at: string | null
          phone_number: string | null
          qr_code: string | null
          qr_endpoint_preference: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          instance_id?: string | null
          last_error?: string | null
          name: string
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          qr_endpoint_preference?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          instance_id?: string | null
          last_error?: string | null
          name?: string
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          qr_endpoint_preference?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_empresa_limit: {
        Args: { _empresa_id: string; _limit_type: string }
        Returns: Json
      }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      increment_sent_messages: {
        Args: { campaign_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      reset_monthly_dispatch_counters: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
