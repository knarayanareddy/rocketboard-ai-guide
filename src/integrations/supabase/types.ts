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
          max_sections_hint: number
          mermaid_enabled: boolean
          output_language: string
          pack_id: string | null
          target_reading_level: string
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
          max_sections_hint?: number
          mermaid_enabled?: boolean
          output_language?: string
          pack_id?: string | null
          target_reading_level?: string
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
          max_sections_hint?: number
          mermaid_enabled?: boolean
          output_language?: string
          pack_id?: string | null
          target_reading_level?: string
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
      bookmark_collections: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
          pack_id: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          pack_id: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          pack_id?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmark_collections_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          bookmark_type: string
          collection_id: string | null
          created_at: string
          id: string
          is_pinned: boolean | null
          label: string | null
          pack_id: string
          preview_text: string | null
          reference_key: string
          subtitle: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          bookmark_type: string
          collection_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          label?: string | null
          pack_id: string
          preview_text?: string | null
          reference_key: string
          subtitle?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          bookmark_type?: string
          collection_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          label?: string | null
          pack_id?: string
          preview_text?: string | null
          reference_key?: string
          subtitle?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "bookmark_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_pack_id_fkey"
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
      cohort_members: {
        Row: {
          cohort_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          pack_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          pack_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          pack_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_type: string
          id: string
          is_resolved: boolean
          module_key: string
          pack_id: string
          resolved_at: string | null
          resolved_by: string | null
          section_id: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          is_resolved?: boolean
          module_key: string
          pack_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          is_resolved?: boolean
          module_key?: string
          pack_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_feedback_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_freshness: {
        Row: {
          chunk_hash_at_generation: Json | null
          chunks_snapshot: Json | null
          id: string
          is_stale: boolean
          last_checked_at: string | null
          module_key: string
          pack_id: string
          referenced_chunk_ids: string[] | null
          section_id: string
          staleness_details: Json | null
        }
        Insert: {
          chunk_hash_at_generation?: Json | null
          chunks_snapshot?: Json | null
          id?: string
          is_stale?: boolean
          last_checked_at?: string | null
          module_key: string
          pack_id: string
          referenced_chunk_ids?: string[] | null
          section_id: string
          staleness_details?: Json | null
        }
        Update: {
          chunk_hash_at_generation?: Json | null
          chunks_snapshot?: Json | null
          id?: string
          is_stale?: boolean
          last_checked_at?: string | null
          module_key?: string
          pack_id?: string
          referenced_chunk_ids?: string[] | null
          section_id?: string
          staleness_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_freshness_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ratings: {
        Row: {
          created_at: string
          id: string
          module_key: string
          pack_id: string
          rating: number
          section_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          pack_id: string
          rating: number
          section_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          pack_id?: string
          rating?: number
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ratings_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_accepted_answer: boolean | null
          thread_id: string
          upvote_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_accepted_answer?: boolean | null
          thread_id: string
          upvote_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_accepted_answer?: boolean | null
          thread_id?: string
          upvote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_threads: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          is_resolved: boolean | null
          module_key: string | null
          pack_id: string
          reply_count: number | null
          section_id: string | null
          thread_type: string | null
          title: string
          updated_at: string | null
          upvote_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          module_key?: string | null
          pack_id: string
          reply_count?: number | null
          section_id?: string | null
          thread_type?: string | null
          title: string
          updated_at?: string | null
          upvote_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          module_key?: string | null
          pack_id?: string
          reply_count?: number | null
          section_id?: string | null
          thread_type?: string | null
          title?: string
          updated_at?: string | null
          upvote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_threads_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_upvotes: {
        Row: {
          created_at: string | null
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_submissions: {
        Row: {
          ai_feedback: Json | null
          content: string
          exercise_key: string
          hints_used: number | null
          id: string
          pack_id: string
          status: string | null
          submission_type: string
          submitted_at: string | null
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          ai_feedback?: Json | null
          content: string
          exercise_key: string
          hints_used?: number | null
          id?: string
          pack_id: string
          status?: string | null
          submission_type: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          ai_feedback?: Json | null
          content?: string
          exercise_key?: string
          hints_used?: number | null
          id?: string
          pack_id?: string
          status?: string | null
          submission_type?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_submissions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          description: string
          difficulty: string | null
          estimated_minutes: number | null
          evidence_citations: Json | null
          exercise_key: string
          exercise_type: string
          hints: Json | null
          id: string
          module_key: string
          pack_id: string
          section_id: string | null
          sort_order: number | null
          title: string
          verification: Json | null
        }
        Insert: {
          created_at?: string | null
          description: string
          difficulty?: string | null
          estimated_minutes?: number | null
          evidence_citations?: Json | null
          exercise_key: string
          exercise_type: string
          hints?: Json | null
          id?: string
          module_key: string
          pack_id: string
          section_id?: string | null
          sort_order?: number | null
          title: string
          verification?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string
          difficulty?: string | null
          estimated_minutes?: number | null
          evidence_citations?: Json | null
          exercise_key?: string
          exercise_type?: string
          hints?: Json | null
          id?: string
          module_key?: string
          pack_id?: string
          section_id?: string | null
          sort_order?: number | null
          title?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_pack_id_fkey"
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
      generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          module_key: string | null
          pack_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          module_key?: string | null
          pack_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          module_key?: string | null
          pack_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_pack_id_fkey"
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
      integration_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credentials_encrypted: string
          id: string
          label: string | null
          org_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credentials_encrypted: string
          id?: string
          label?: string | null
          org_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string
          id?: string
          label?: string | null
          org_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_checks: {
        Row: {
          check_type: string
          created_at: string
          id: string
          module_key: string
          pack_id: string
          questions_data: Json | null
          score: number
          total: number
          user_id: string
        }
        Insert: {
          check_type: string
          created_at?: string
          id?: string
          module_key: string
          pack_id: string
          questions_data?: Json | null
          score: number
          total: number
          user_id: string
        }
        Update: {
          check_type?: string
          created_at?: string
          id?: string
          module_key?: string
          pack_id?: string
          questions_data?: Json | null
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_checks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
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
      learner_badges: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          pack_id: string | null
          user_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          pack_id?: string | null
          user_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          pack_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_badges_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_milestone_progress: {
        Row: {
          completed_at: string | null
          id: string
          milestone_id: string
          pack_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          milestone_id: string
          pack_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          milestone_id?: string
          pack_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_milestone_progress_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "onboarding_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_milestone_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
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
      learner_streaks: {
        Row: {
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          pack_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          pack_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          pack_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_streaks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_xp: {
        Row: {
          amount: number
          earned_at: string
          id: string
          pack_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          amount?: number
          earned_at?: string
          id?: string
          pack_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          earned_at?: string
          id?: string
          pack_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_xp_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_checklist: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          priority: string
          suggested_topics: string[] | null
          team_member_id: string
          time_estimate_minutes: number | null
          track_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          priority?: string
          suggested_topics?: string[] | null
          team_member_id: string
          time_estimate_minutes?: number | null
          track_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          priority?: string
          suggested_topics?: string[] | null
          team_member_id?: string
          time_estimate_minutes?: number | null
          track_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_checklist_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_checklist_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_progress: {
        Row: {
          id: string
          is_met: boolean
          met_at: string | null
          notes: string | null
          pack_id: string
          team_member_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_met?: boolean
          met_at?: string | null
          notes?: string | null
          pack_id: string
          team_member_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_met?: boolean
          met_at?: string | null
          notes?: string | null
          pack_id?: string
          team_member_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_progress_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          created_at: string
          id: string
          min_completion_percentage: number
          min_quiz_score: number
          module_key: string
          pack_id: string
          requirement_type: string
          requires_module_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_completion_percentage?: number
          min_quiz_score?: number
          module_key: string
          pack_id: string
          requirement_type?: string
          requires_module_key: string
        }
        Update: {
          created_at?: string
          id?: string
          min_completion_percentage?: number
          min_quiz_score?: number
          module_key?: string
          pack_id?: string
          requirement_type?: string
          requires_module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_pack_id_fkey"
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
      notification_preferences: {
        Row: {
          created_at: string
          email_invites: boolean
          email_milestones: boolean
          email_module_published: boolean
          email_weekly_digest: boolean
          id: string
          pack_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_invites?: boolean
          email_milestones?: boolean
          email_module_published?: boolean
          email_weekly_digest?: boolean
          id?: string
          pack_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_invites?: boolean
          email_milestones?: boolean
          email_module_published?: boolean
          email_weekly_digest?: boolean
          id?: string
          pack_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_milestones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          pack_id: string
          phase: string
          sort_order: number
          target_type: string
          target_value: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          pack_id: string
          phase?: string
          sort_order?: number
          target_type?: string
          target_value?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          pack_id?: string
          phase?: string
          sort_order?: number
          target_type?: string
          target_value?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_milestones_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_schedule: {
        Row: {
          created_at: string
          expected_completion_date: string | null
          id: string
          pack_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          pack_id: string
          start_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          pack_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_schedule_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
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
      pack_generation_limits: {
        Row: {
          id: string
          max_key_takeaways: number
          max_module_words: number
          max_quiz_questions: number
          pack_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          max_key_takeaways?: number
          max_module_words?: number
          max_quiz_questions?: number
          pack_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          max_key_takeaways?: number
          max_module_words?: number
          max_quiz_questions?: number
          pack_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_generation_limits_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: true
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
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
          source_config: Json | null
          source_type: string
          source_uri: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          pack_id: string
          source_config?: Json | null
          source_type: string
          source_uri: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          pack_id?: string
          source_config?: Json | null
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
      peer_visibility_preferences: {
        Row: {
          allow_direct_messages: boolean | null
          id: string
          pack_id: string
          show_my_activity: boolean | null
          show_my_progress: boolean | null
          user_id: string
        }
        Insert: {
          allow_direct_messages?: boolean | null
          id?: string
          pack_id: string
          show_my_activity?: boolean | null
          show_my_progress?: boolean | null
          user_id: string
        }
        Update: {
          allow_direct_messages?: boolean | null
          id?: string
          pack_id?: string
          show_my_activity?: boolean | null
          show_my_progress?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_visibility_preferences_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          accepted_at: string | null
          access_level: string
          created_at: string
          email: string
          id: string
          invited_by: string
          pack_id: string
        }
        Insert: {
          accepted_at?: string | null
          access_level?: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          pack_id: string
        }
        Update: {
          accepted_at?: string | null
          access_level?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_pack_id_fkey"
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
      quiz_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_correct: boolean
          module_key: string
          pack_id: string
          question_id: string
          selected_choice_id: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct: boolean
          module_key: string
          pack_id: string
          question_id: string
          selected_choice_id: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean
          module_key?: string
          pack_id?: string
          question_id?: string
          selected_choice_id?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_type: string
          id: string
          module_key: string
          pack_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          module_key: string
          pack_id: string
          question_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          module_key?: string
          pack_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_feedback_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
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
      review_schedule: {
        Row: {
          id: string
          last_reviewed_at: string | null
          module_key: string
          next_review_date: string
          pack_id: string
          review_count: number
          user_id: string
        }
        Insert: {
          id?: string
          last_reviewed_at?: string | null
          module_key: string
          next_review_date?: string
          pack_id: string
          review_count?: number
          user_id: string
        }
        Update: {
          id?: string
          last_reviewed_at?: string | null
          module_key?: string
          next_review_date?: string
          pack_id?: string
          review_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_schedule_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_integrations: {
        Row: {
          channel_name: string | null
          created_at: string
          created_by: string | null
          id: string
          notify_on_invite: boolean
          notify_on_module_complete: boolean
          notify_on_new_source: boolean
          pack_id: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          channel_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notify_on_invite?: boolean
          notify_on_module_complete?: boolean
          notify_on_new_source?: boolean
          pack_id: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          channel_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notify_on_invite?: boolean
          notify_on_module_complete?: boolean
          notify_on_new_source?: boolean
          pack_id?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_integrations_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: true
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          areas_of_expertise: string[] | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          github_handle: string | null
          id: string
          is_auto_detected: boolean
          name: string
          pack_id: string
          role_title: string | null
          services_owned: string[] | null
          slack_handle: string | null
        }
        Insert: {
          areas_of_expertise?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          github_handle?: string | null
          id?: string
          is_auto_detected?: boolean
          name: string
          pack_id: string
          role_title?: string | null
          services_owned?: string[] | null
          slack_handle?: string | null
        }
        Update: {
          areas_of_expertise?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          github_handle?: string | null
          id?: string
          is_auto_detected?: boolean
          name?: string
          pack_id?: string
          role_title?: string | null
          services_owned?: string[] | null
          slack_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_pack_id_fkey"
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
      accept_pending_invites: {
        Args: { _email: string; _user_id: string }
        Returns: number
      }
      decrement_reply_upvote: { Args: { reply_id: string }; Returns: undefined }
      decrement_thread_upvote: {
        Args: { thread_id: string }
        Returns: undefined
      }
      get_cohort_pack_id: { Args: { _cohort_id: string }; Returns: string }
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      get_pack_access_level: {
        Args: { _pack_id: string; _user_id: string }
        Returns: string
      }
      get_thread_pack_id: { Args: { _thread_id: string }; Returns: string }
      has_pack_access: {
        Args: { _min_level: string; _pack_id: string; _user_id: string }
        Returns: boolean
      }
      increment_reply_upvote: { Args: { reply_id: string }; Returns: undefined }
      increment_thread_reply_count: {
        Args: { thread_id: string }
        Returns: undefined
      }
      increment_thread_upvote: {
        Args: { thread_id: string }
        Returns: undefined
      }
      is_cohort_member: {
        Args: { _cohort_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
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
