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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          device_label: string | null
          id: string
          ip_address: unknown
          last_seen_at: string
          revoke_reason: string | null
          revoked_at: string | null
          session_token_hash: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          device_label?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          session_token_hash: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          device_label?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          session_token_hash?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      affiliate_sales: {
        Row: {
          activated_at: string | null
          admin_note: string | null
          affiliate_id: string
          amount_cents: number
          commission_cents: number
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_whatsapp: string | null
          id: string
          paid_at: string | null
          pix_proof_note: string | null
          plan_code: string
          status: string
          updated_at: string
          user_access_id: string | null
        }
        Insert: {
          activated_at?: string | null
          admin_note?: string | null
          affiliate_id: string
          amount_cents?: number
          commission_cents?: number
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_whatsapp?: string | null
          id?: string
          paid_at?: string | null
          pix_proof_note?: string | null
          plan_code?: string
          status?: string
          updated_at?: string
          user_access_id?: string | null
        }
        Update: {
          activated_at?: string | null
          admin_note?: string | null
          affiliate_id?: string
          amount_cents?: number
          commission_cents?: number
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_whatsapp?: string | null
          id?: string
          paid_at?: string | null
          pix_proof_note?: string | null
          plan_code?: string
          status?: string
          updated_at?: string
          user_access_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_sales_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_sales_user_access_id_fkey"
            columns: ["user_access_id"]
            isOneToOne: false
            referencedRelation: "user_access"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          commission_cents: number
          created_at: string
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          password_hash: string
          pix_key: string | null
          slug: string
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          commission_cents?: number
          created_at?: string
          email: string
          full_name: string
          id?: string
          last_login_at?: string | null
          password_hash: string
          pix_key?: string | null
          slug: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          commission_cents?: number
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string
          pix_key?: string | null
          slug?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      asset_downloads: {
        Row: {
          created_at: string
          downloaded_at: string | null
          halftone_mode: Database["public"]["Enums"]["halftone_mode"]
          id: string
          output_filename: string | null
          processing_ms: number | null
          source_filename: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          downloaded_at?: string | null
          halftone_mode: Database["public"]["Enums"]["halftone_mode"]
          id?: string
          output_filename?: string | null
          processing_ms?: number | null
          source_filename?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          downloaded_at?: string | null
          halftone_mode?: Database["public"]["Enums"]["halftone_mode"]
          id?: string
          output_filename?: string | null
          processing_ms?: number | null
          source_filename?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      catalog_batches: {
        Row: {
          category: string
          completed_items: number
          created_at: string
          failed_items: number
          id: string
          name: string
          prefix: string
          public_token: string
          published_at: string | null
          settings: Json
          status: string
          total_items: number
          updated_at: string
          user_access_id: string
        }
        Insert: {
          category?: string
          completed_items?: number
          created_at?: string
          failed_items?: number
          id?: string
          name: string
          prefix?: string
          public_token?: string
          published_at?: string | null
          settings?: Json
          status?: string
          total_items?: number
          updated_at?: string
          user_access_id: string
        }
        Update: {
          category?: string
          completed_items?: number
          created_at?: string
          failed_items?: number
          id?: string
          name?: string
          prefix?: string
          public_token?: string
          published_at?: string | null
          settings?: Json
          status?: string
          total_items?: number
          updated_at?: string
          user_access_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_batches_user_access_id_fkey"
            columns: ["user_access_id"]
            isOneToOne: false
            referencedRelation: "user_access"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          batch_id: string
          category: string
          code: string
          created_at: string
          description: string
          error_message: string | null
          id: string
          mockup_paths: Json
          name: string
          original_path: string
          product_data: Json
          sort_order: number
          source_filename: string
          status: string
          updated_at: string
          user_access_id: string
        }
        Insert: {
          batch_id: string
          category: string
          code: string
          created_at?: string
          description?: string
          error_message?: string | null
          id?: string
          mockup_paths?: Json
          name: string
          original_path: string
          product_data?: Json
          sort_order?: number
          source_filename: string
          status?: string
          updated_at?: string
          user_access_id: string
        }
        Update: {
          batch_id?: string
          category?: string
          code?: string
          created_at?: string
          description?: string
          error_message?: string | null
          id?: string
          mockup_paths?: Json
          name?: string
          original_path?: string
          product_data?: Json
          sort_order?: number
          source_filename?: string
          status?: string
          updated_at?: string
          user_access_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_user_access_id_fkey"
            columns: ["user_access_id"]
            isOneToOne: false
            referencedRelation: "user_access"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          updated_at: string
          user_access_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          updated_at?: string
          user_access_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
          user_access_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_templates_user_access_id_fkey"
            columns: ["user_access_id"]
            isOneToOne: false
            referencedRelation: "user_access"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      halftone_orders: {
        Row: {
          amount: number
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_status: string
          id: string
          image_path: string
          infinitepay_transaction_id: string | null
          notes: string | null
          order_code: string
          paid_at: string | null
          payment_status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          image_path: string
          infinitepay_transaction_id?: string | null
          notes?: string | null
          order_code: string
          paid_at?: string | null
          payment_status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          image_path?: string
          infinitepay_transaction_id?: string | null
          notes?: string | null
          order_code?: string
          paid_at?: string | null
          payment_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          email: string
          id: string
          status: string
          stripe_session_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          email: string
          id?: string
          status: string
          stripe_session_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          email?: string
          id?: string
          status?: string
          stripe_session_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          billing_period: Database["public"]["Enums"]["billing_period"]
          code: string
          created_at: string
          currency: string
          id: string
          name: string
          price_cents: number
          prompt_library_included: boolean
          support_group_included: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_period: Database["public"]["Enums"]["billing_period"]
          code: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          price_cents: number
          prompt_library_included?: boolean
          support_group_included?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_period?: Database["public"]["Enums"]["billing_period"]
          code?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          price_cents?: number
          prompt_library_included?: boolean
          support_group_included?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_login_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_access: {
        Row: {
          access_code: string
          active_session_ip: string | null
          active_session_started_at: string | null
          active_session_token: string | null
          active_session_user_agent: string | null
          created_at: string
          device_limit: number
          email: string
          expires_at: string
          id: string
          is_trial: boolean
          last_activity_at: string | null
          phone: string | null
          plan_code: string | null
          status: string
          trial_device_fp: string | null
        }
        Insert: {
          access_code: string
          active_session_ip?: string | null
          active_session_started_at?: string | null
          active_session_token?: string | null
          active_session_user_agent?: string | null
          created_at?: string
          device_limit?: number
          email: string
          expires_at: string
          id?: string
          is_trial?: boolean
          last_activity_at?: string | null
          phone?: string | null
          plan_code?: string | null
          status?: string
          trial_device_fp?: string | null
        }
        Update: {
          access_code?: string
          active_session_ip?: string | null
          active_session_started_at?: string | null
          active_session_token?: string | null
          active_session_user_agent?: string | null
          created_at?: string
          device_limit?: number
          email?: string
          expires_at?: string
          id?: string
          is_trial?: boolean
          last_activity_at?: string | null
          phone?: string | null
          plan_code?: string | null
          status?: string
          trial_device_fp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      billing_period: "monthly" | "annual"
      halftone_mode: "circular" | "rosette_cmyk"
      session_status: "active" | "revoked" | "expired"
      subscription_status:
        | "pending"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "customer"],
      billing_period: ["monthly", "annual"],
      halftone_mode: ["circular", "rosette_cmyk"],
      session_status: ["active", "revoked", "expired"],
      subscription_status: [
        "pending",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
    },
  },
} as const
