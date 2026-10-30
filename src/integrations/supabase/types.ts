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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          reminder_days: Json
          updated_at: string
        }
        Insert: {
          id: string
          reminder_days?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          reminder_days?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string
          at: string
          detail: string
          id: string
          record_id: string | null
          record_ref: string | null
        }
        Insert: {
          action: string
          actor: string
          at: string
          detail: string
          id: string
          record_id?: string | null
          record_ref?: string | null
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          detail?: string
          id?: string
          record_id?: string | null
          record_ref?: string | null
        }
        Relationships: []
      }
      fdrs: {
        Row: {
          action_due: string | null
          bank: string
          branch: string
          created_at: string
          documents: Json
          extracted: Json | null
          fdr_number: string
          flags: Json
          id: string
          institution: string
          issue_date: string
          lifecycle: string
          maturity_date: string
          next_action: string
          officer: string | null
          principal: number
          rate: number
          ref: string
          renewed_from_id: string | null
          renewed_to_id: string | null
          submitted_at: string
          tenure_months: number
          timeline: Json
          updated_at: string
          verification: string
        }
        Insert: {
          action_due?: string | null
          bank: string
          branch: string
          created_at?: string
          documents?: Json
          extracted?: Json | null
          fdr_number: string
          flags?: Json
          id: string
          institution: string
          issue_date: string
          lifecycle: string
          maturity_date: string
          next_action?: string
          officer?: string | null
          principal: number
          rate: number
          ref: string
          renewed_from_id?: string | null
          renewed_to_id?: string | null
          submitted_at: string
          tenure_months: number
          timeline?: Json
          updated_at?: string
          verification: string
        }
        Update: {
          action_due?: string | null
          bank?: string
          branch?: string
          created_at?: string
          documents?: Json
          extracted?: Json | null
          fdr_number?: string
          flags?: Json
          id?: string
          institution?: string
          issue_date?: string
          lifecycle?: string
          maturity_date?: string
          next_action?: string
          officer?: string | null
          principal?: number
          rate?: number
          ref?: string
          renewed_from_id?: string | null
          renewed_to_id?: string | null
          submitted_at?: string
          tenure_months?: number
          timeline?: Json
          updated_at?: string
          verification?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          at: string
          body: string
          fdr_id: string | null
          id: string
          read: boolean
          title: string
        }
        Insert: {
          at: string
          body: string
          fdr_id?: string | null
          id: string
          read?: boolean
          title: string
        }
        Update: {
          at?: string
          body?: string
          fdr_id?: string | null
          id?: string
          read?: boolean
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          institution: string
          is_placeholder: boolean
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          institution?: string
          is_placeholder?: boolean
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          institution?: string
          is_placeholder?: boolean
          name?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          completion: Json | null
          conditions: Json
          created_at: string
          docs: Json
          fdr_id: string
          history: Json
          id: string
          kind: string
          officer: string | null
          reason: string
          ref: string
          stage: string
        }
        Insert: {
          completion?: Json | null
          conditions?: Json
          created_at: string
          docs?: Json
          fdr_id: string
          history?: Json
          id: string
          kind: string
          officer?: string | null
          reason: string
          ref: string
          stage: string
        }
        Update: {
          completion?: Json | null
          conditions?: Json
          created_at?: string
          docs?: Json
          fdr_id?: string
          history?: Json
          id?: string
          kind?: string
          officer?: string | null
          reason?: string
          ref?: string
          stage?: string
        }
        Relationships: []
      }
      renewals: {
        Row: {
          created_at: string
          history: Json
          id: string
          new_id: string
          old_id: string
          ref: string
          remarks: string
          stage: string
        }
        Insert: {
          created_at: string
          history?: Json
          id: string
          new_id: string
          old_id: string
          ref: string
          remarks: string
          stage: string
        }
        Update: {
          created_at?: string
          history?: Json
          id?: string
          new_id?: string
          old_id?: string
          ref?: string
          remarks?: string
          stage?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "operator" | "reviewer" | "approver"
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
      app_role: ["operator", "reviewer", "approver"],
    },
  },
} as const
