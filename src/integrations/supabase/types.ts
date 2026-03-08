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
      ask_lead_progress: {
        Row: {
          asked_at: string | null
          id: string
          is_asked: boolean
          pack_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          asked_at?: string | null
          id?: string
          is_asked?: boolean
          pack_id: string
          question_id: string
          user_id: string
        }
        Update: {
          asked_at?: string | null
          id?: string
          is_asked?: boolean
          pack_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ask_lead_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_preferences: {
        Row: {
          audience: string
          created_at: string
          depth: string
          experience_level: string | null
          glossary_density: string
          id: string
          learner_role: string | null
          mermaid_enabled: boolean
          output_language: string
          pack_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string
          created_at?: string
          depth?: string
          experience_level?: string | null
          glossary_density?: string
          id?: string
          learner_role?: string | null
          mermaid_enabled?: boolean
          output_language?: string
          pack_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          depth?: string
          experience_level?: string | null
          glossary_density?: string
          id?: string
          learner_role?: string | null
          mermaid_enabled?: boolean
          output_language?: string
          pack_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_preferences_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          module_id: string
          pack_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          module_id: string
          pack_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          module_id?: string
          pack_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_ask_lead: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          questions_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          questions_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          questions_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_ask_lead_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_glossaries: {
        Row: {
          created_at: string
          glossary_data: Json
          glossary_density: string | null
          id: string
          pack_id: string
        }
        Insert: {
          created_at?: string
          glossary_data?: Json
          glossary_density?: string | null
          id?: string
          pack_id: string
        }
        Update: {
          created_at?: string
          glossary_data?: Json
          glossary_density?: string | null
          id?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_glossaries_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_modules: {
        Row: {
          audience: string | null
          contradictions: Json | null
          created_at: string
          depth: string | null
          description: string | null
          difficulty: string | null
          estimated_minutes: number | null
          id: string
          module_data: Json
          module_key: string
          module_revision: number
          pack_id: string
          status: string
          title: string
          track_key: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          contradictions?: Json | null
          created_at?: string
          depth?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          id?: string
          module_data?: Json
          module_key: string
          module_revision?: number
          pack_id: string
          status?: string
          title: string
          track_key?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          contradictions?: Json | null
          created_at?: string
          depth?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          id?: string
          module_data?: Json
          module_key?: string
          module_revision?: number
          pack_id?: string
          status?: string
          title?: string
          track_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_modules_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_paths: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          paths_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          paths_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          paths_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_paths_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_quizzes: {
        Row: {
          created_at: string
          id: string
          module_key: string
          pack_id: string
          quiz_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          pack_id: string
          quiz_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          pack_id?: string
          quiz_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_quizzes_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          pack_id: string
          processed_chunks: number | null
          source_id: string | null
          started_at: string | null
          status: string
          total_chunks: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          pack_id: string
          processed_chunks?: number | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          total_chunks?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          pack_id?: string
          processed_chunks?: number | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          total_chunks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_id: string
          content: string
          content_hash: string
          created_at: string
          end_line: number
          fts: unknown
          id: string
          is_redacted: boolean | null
          metadata: Json | null
          pack_id: string
          path: string
          source_id: string
          start_line: number
        }
        Insert: {
          chunk_id: string
          content: string
          content_hash: string
          created_at?: string
          end_line: number
          fts?: unknown
          id?: string
          is_redacted?: boolean | null
          metadata?: Json | null
          pack_id: string
          path: string
          source_id: string
          start_line: number
        }
        Update: {
          chunk_id?: string
          content?: string
          content_hash?: string
          created_at?: string
          end_line?: number
          fts?: unknown
          id?: string
          is_redacted?: boolean | null
          metadata?: Json | null
          pack_id?: string
          path?: string
          source_id?: string
          start_line?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          module_id: string
          pack_id: string | null
          section_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          module_id: string
          pack_id?: string | null
          section_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          module_id?: string
          pack_id?: string | null
          section_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_notes_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_state: {
        Row: {
          id: string
          last_opened_module_id: string | null
          last_opened_track_key: string | null
          pack_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_opened_module_id?: string | null
          last_opened_track_key?: string | null
          pack_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_opened_module_id?: string | null
          last_opened_track_key?: string | null
          pack_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_state_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pack_id: string
          pack_version: number
          plan_data: Json
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pack_id: string
          pack_version: number
          plan_data?: Json
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pack_id?: string
          pack_version?: number
          plan_data?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_plans_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          template_data: Json
          template_key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          template_data?: Json
          template_key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          template_data?: Json
          template_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      pack_members: {
        Row: {
          access_level: string
          id: string
          joined_at: string
          pack_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          id?: string
          joined_at?: string
          pack_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          id?: string
          joined_at?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_members_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_sources: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_synced_at: string | null
          pack_id: string
          source_type: string
          source_uri: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          pack_id: string
          source_type: string
          source_uri: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          pack_id?: string
          source_type?: string
          source_uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_sources_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_tracks: {
        Row: {
          description: string | null
          id: string
          pack_id: string
          title: string
          track_key: string
        }
        Insert: {
          description?: string | null
          id?: string
          pack_id: string
          title: string
          track_key: string
        }
        Update: {
          description?: string | null
          id?: string
          pack_id?: string
          title?: string
          track_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_tracks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          language_mode: string
          org_id: string
          pack_version: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          language_mode?: string
          org_id: string
          pack_version?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          language_mode?: string
          org_id?: string
          pack_version?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      path_progress: {
        Row: {
          checked_at: string | null
          id: string
          is_checked: boolean
          pack_id: string
          path_type: string
          step_id: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          id?: string
          is_checked?: boolean
          pack_id: string
          path_type: string
          step_id: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          id?: string
          is_checked?: boolean
          pack_id?: string
          path_type?: string
          step_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_scores: {
        Row: {
          completed_at: string
          id: string
          module_id: string
          pack_id: string | null
          score: number
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          module_id: string
          pack_id?: string | null
          score: number
          total: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          module_id?: string
          pack_id?: string | null
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_scores_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          id: string
          is_read: boolean
          module_id: string
          pack_id: string | null
          read_at: string
          section_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_read?: boolean
          module_id: string
          pack_id?: string | null
          read_at?: string
          section_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_read?: boolean
          module_id?: string
          pack_id?: string | null
          read_at?: string
          section_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      get_pack_access_level: {
        Args: { _pack_id: string; _user_id: string }
        Returns: string
      }
      has_pack_access: {
        Args: { _min_level: string; _pack_id: string; _user_id: string }
        Returns: boolean
      }
      is_pack_member: {
        Args: { _pack_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
