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
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          processed_at: string | null
          reason: string | null
          requested_at: string
          scheduled_for: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          reason: string | null
          source: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          source?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          source?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      ai_actions: {
        Row: {
          auto_approved: boolean
          confidence: number | null
          created_at: string
          edited_payload: Json | null
          error: string | null
          executed_at: string | null
          id: string
          kind: string
          model: string | null
          payload: Json
          preview: string | null
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string
          status: string
          target_id: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          auto_approved?: boolean
          confidence?: number | null
          created_at?: string
          edited_payload?: Json | null
          error?: string | null
          executed_at?: string | null
          id?: string
          kind: string
          model?: string | null
          payload?: Json
          preview?: string | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          auto_approved?: boolean
          confidence?: number | null
          created_at?: string
          edited_payload?: Json | null
          error?: string | null
          executed_at?: string | null
          id?: string
          kind?: string
          model?: string | null
          payload?: Json
          preview?: string | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_auto_approve_settings: {
        Row: {
          id: number
          rules: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          rules?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          rules?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance_claims: {
        Row: {
          ai_confidence: number | null
          ai_decision: string | null
          ai_reasoning: string | null
          auto_approve_at: string
          booking_id: string
          course_id: string
          created_at: string
          evidence: Json
          id: string
          instructor_id: string
          instructor_note: string | null
          last_reminder_at: string | null
          reminder_count: number
          resolved_at: string | null
          status: string
          student_id: string
          student_responded_at: string | null
          student_response_note: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_decision?: string | null
          ai_reasoning?: string | null
          auto_approve_at?: string
          booking_id: string
          course_id: string
          created_at?: string
          evidence?: Json
          id?: string
          instructor_id: string
          instructor_note?: string | null
          last_reminder_at?: string | null
          reminder_count?: number
          resolved_at?: string | null
          status?: string
          student_id: string
          student_responded_at?: string | null
          student_response_note?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_decision?: string | null
          ai_reasoning?: string | null
          auto_approve_at?: string
          booking_id?: string
          course_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          instructor_id?: string
          instructor_note?: string | null
          last_reminder_at?: string | null
          reminder_count?: number
          resolved_at?: string | null
          status?: string
          student_id?: string
          student_responded_at?: string | null
          student_response_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backup_payment_rails: {
        Row: {
          created_at: string
          created_by: string | null
          credentials: Json
          display_label: string
          environment: string
          id: string
          notes: string | null
          provider_key: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credentials?: Json
          display_label: string
          environment?: string
          id?: string
          notes?: string | null
          provider_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credentials?: Json
          display_label?: string
          environment?: string
          id?: string
          notes?: string | null
          provider_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_fees: {
        Row: {
          booking_id: string
          course_id: string
          course_price_cents: number
          created_at: string
          currency: string
          due_in_person_cents: number
          id: string
          instructor_deposit_cents: number
          instructor_id: string
          online_total_cents: number
          platform_fee_cents: number
          student_id: string
        }
        Insert: {
          booking_id: string
          course_id: string
          course_price_cents: number
          created_at?: string
          currency?: string
          due_in_person_cents: number
          id?: string
          instructor_deposit_cents: number
          instructor_id: string
          online_total_cents: number
          platform_fee_cents: number
          student_id: string
        }
        Update: {
          booking_id?: string
          course_id?: string
          course_price_cents?: number
          created_at?: string
          currency?: string
          due_in_person_cents?: number
          id?: string
          instructor_deposit_cents?: number
          instructor_id?: string
          online_total_cents?: number
          platform_fee_cents?: number
          student_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          attended_at: string | null
          booked_at: string
          cancellation_cutoff_hours: number
          course_id: string
          course_price_cents: number
          created_at: string
          deposit_amount_cents: number
          deposit_confirmed_at: string | null
          deposit_expires_at: string | null
          deposit_handle_used: string | null
          deposit_method: string | null
          deposit_sent_at: string | null
          deposit_status: string
          due_in_person_cents: number
          escrow_held_at: string | null
          escrow_released_at: string | null
          escrow_status: string
          helcim_checkout_token: string | null
          helcim_transaction_id: string | null
          id: string
          in_person_paid_at: string | null
          instructor_deposit_cents: number
          instructor_payout_cents: number
          online_total_cents: number
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          platform_fee_cents: number
          refund_due_at: string | null
          release_attempted_at: string | null
          release_eligible_at: string | null
          release_error: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          attended_at?: string | null
          booked_at?: string
          cancellation_cutoff_hours?: number
          course_id: string
          course_price_cents?: number
          created_at?: string
          deposit_amount_cents?: number
          deposit_confirmed_at?: string | null
          deposit_expires_at?: string | null
          deposit_handle_used?: string | null
          deposit_method?: string | null
          deposit_sent_at?: string | null
          deposit_status?: string
          due_in_person_cents?: number
          escrow_held_at?: string | null
          escrow_released_at?: string | null
          escrow_status?: string
          helcim_checkout_token?: string | null
          helcim_transaction_id?: string | null
          id?: string
          in_person_paid_at?: string | null
          instructor_deposit_cents?: number
          instructor_payout_cents?: number
          online_total_cents?: number
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          platform_fee_cents?: number
          refund_due_at?: string | null
          release_attempted_at?: string | null
          release_eligible_at?: string | null
          release_error?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          attended_at?: string | null
          booked_at?: string
          cancellation_cutoff_hours?: number
          course_id?: string
          course_price_cents?: number
          created_at?: string
          deposit_amount_cents?: number
          deposit_confirmed_at?: string | null
          deposit_expires_at?: string | null
          deposit_handle_used?: string | null
          deposit_method?: string | null
          deposit_sent_at?: string | null
          deposit_status?: string
          due_in_person_cents?: number
          escrow_held_at?: string | null
          escrow_released_at?: string | null
          escrow_status?: string
          helcim_checkout_token?: string | null
          helcim_transaction_id?: string | null
          id?: string
          in_person_paid_at?: string | null
          instructor_deposit_cents?: number
          instructor_payout_cents?: number
          online_total_cents?: number
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          platform_fee_cents?: number
          refund_due_at?: string | null
          release_attempted_at?: string | null
          release_eligible_at?: string | null
          release_error?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      bypass_attempts: {
        Row: {
          action_taken: string
          context: Json | null
          created_at: string
          detected_pattern: string
          field_name: string
          id: string
          original_content: string
          redacted_content: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action_taken: string
          context?: Json | null
          created_at?: string
          detected_pattern: string
          field_name: string
          id?: string
          original_content: string
          redacted_content?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action_taken?: string
          context?: Json | null
          created_at?: string
          detected_pattern?: string
          field_name?: string
          id?: string
          original_content?: string
          redacted_content?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      checkin_attempts: {
        Row: {
          booking_id: string | null
          course_id: string
          created_at: string
          id: string
          instructor_id: string
          outcome: string
          reason: string | null
          source: string
          student_id: string | null
        }
        Insert: {
          booking_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          instructor_id: string
          outcome: string
          reason?: string | null
          source?: string
          student_id?: string | null
        }
        Update: {
          booking_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
          outcome?: string
          reason?: string | null
          source?: string
          student_id?: string | null
        }
        Relationships: []
      }
      cockpit_briefs: {
        Row: {
          action_items: Json
          emailed_at: string | null
          generated_at: string
          id: string
          metrics: Json
          summary: string | null
          week_starting: string
        }
        Insert: {
          action_items?: Json
          emailed_at?: string | null
          generated_at?: string
          id?: string
          metrics?: Json
          summary?: string | null
          week_starting: string
        }
        Update: {
          action_items?: Json
          emailed_at?: string | null
          generated_at?: string
          id?: string
          metrics?: Json
          summary?: string | null
          week_starting?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          booking_id: string | null
          course_id: string | null
          course_title: string | null
          created_at: string
          id: string
          instructor_id: string
          instructor_name: string | null
          instructor_photo: string | null
          last_message: string | null
          last_message_at: string
          student_id: string
          student_name: string | null
          student_photo: string | null
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          course_id?: string | null
          course_title?: string | null
          created_at?: string
          id?: string
          instructor_id: string
          instructor_name?: string | null
          instructor_photo?: string | null
          last_message?: string | null
          last_message_at?: string
          student_id: string
          student_name?: string | null
          student_photo?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          course_id?: string | null
          course_title?: string | null
          created_at?: string
          id?: string
          instructor_id?: string
          instructor_name?: string | null
          instructor_photo?: string | null
          last_message?: string | null
          last_message_at?: string
          student_id?: string
          student_name?: string | null
          student_photo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_featured_placements: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          sort_order: number
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          sort_order?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      course_waivers: {
        Row: {
          ai_generated: boolean
          ai_model: string | null
          content: string
          course_id: string
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_generated?: boolean
          ai_model?: string | null
          content: string
          course_id: string
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_generated?: boolean
          ai_model?: string | null
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          address: string | null
          capacity: number | null
          category: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          ends_at: string | null
          gallery_urls: string[]
          id: string
          in_person_waiver: boolean
          instructor_id: string
          lat: number | null
          lng: number | null
          location_name: string | null
          moderation_reason: string | null
          moderation_severity: string | null
          moderation_status: string
          price_cents: number
          primary_pillar: Database["public"]["Enums"]["skill_pillar"] | null
          secondary_pillar: Database["public"]["Enums"]["skill_pillar"] | null
          skill_level: string
          starts_at: string | null
          state: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          category?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          gallery_urls?: string[]
          id?: string
          in_person_waiver?: boolean
          instructor_id: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          moderation_reason?: string | null
          moderation_severity?: string | null
          moderation_status?: string
          price_cents?: number
          primary_pillar?: Database["public"]["Enums"]["skill_pillar"] | null
          secondary_pillar?: Database["public"]["Enums"]["skill_pillar"] | null
          skill_level?: string
          starts_at?: string | null
          state?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          category?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          gallery_urls?: string[]
          id?: string
          in_person_waiver?: boolean
          instructor_id?: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          moderation_reason?: string | null
          moderation_severity?: string | null
          moderation_status?: string
          price_cents?: number
          primary_pillar?: Database["public"]["Enums"]["skill_pillar"] | null
          secondary_pillar?: Database["public"]["Enums"]["skill_pillar"] | null
          skill_level?: string
          starts_at?: string | null
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credential_decision_log: {
        Row: {
          ai_confidence: number | null
          ai_name_match_score: number | null
          created_at: string
          credential_id: string
          decided_by: string | null
          decided_by_kind: string
          id: string
          instructor_id: string
          new_status: string
          old_status: string | null
          reason: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_name_match_score?: number | null
          created_at?: string
          credential_id: string
          decided_by?: string | null
          decided_by_kind?: string
          id?: string
          instructor_id: string
          new_status: string
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_name_match_score?: number | null
          created_at?: string
          credential_id?: string
          decided_by?: string | null
          decided_by_kind?: string
          id?: string
          instructor_id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_decision_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "instructor_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_status: {
        Row: {
          created_at: string
          domain: string
          error: string | null
          http_status: number | null
          https_ok: boolean | null
          id: string
          last_checked_at: string | null
          ssl_days_remaining: number | null
          ssl_expires_at: string | null
          ssl_valid: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          error?: string | null
          http_status?: number | null
          https_ok?: boolean | null
          id?: string
          last_checked_at?: string | null
          ssl_days_remaining?: number | null
          ssl_expires_at?: string | null
          ssl_valid?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          error?: string | null
          http_status?: number | null
          https_ok?: boolean | null
          id?: string
          last_checked_at?: string | null
          ssl_days_remaining?: number | null
          ssl_expires_at?: string | null
          ssl_valid?: boolean | null
          updated_at?: string
        }
        Relationships: []
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
      feature_flags: {
        Row: {
          audience: string
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          rollout_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fee_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          deposit_pct: number | null
          id: string
          note: string | null
          platform_fee_cents: number | null
          platform_fee_pct: number | null
          scope: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deposit_pct?: number | null
          id?: string
          note?: string | null
          platform_fee_cents?: number | null
          platform_fee_pct?: number | null
          scope: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deposit_pct?: number | null
          id?: string
          note?: string | null
          platform_fee_cents?: number | null
          platform_fee_pct?: number | null
          scope?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback_submissions: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          page_url: string | null
          status: string
          subject: string
          submitter_email: string | null
          submitter_name: string | null
          submitter_role: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          status?: string
          subject: string
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_role?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          status?: string
          subject?: string
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_role?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      flagged_content: {
        Row: {
          admin_notes: string | null
          ai_raw: Json | null
          author_id: string | null
          author_role: string | null
          category: string
          content_id: string | null
          content_type: string
          conversation_id: string | null
          course_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          ai_raw?: Json | null
          author_id?: string | null
          author_role?: string | null
          category: string
          content_id?: string | null
          content_type: string
          conversation_id?: string | null
          course_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          ai_raw?: Json | null
          author_id?: string | null
          author_role?: string | null
          category?: string
          content_id?: string | null
          content_type?: string
          conversation_id?: string | null
          course_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      founding_instructors: {
        Row: {
          created_at: string
          founder_rank: number
          founder_status: Database["public"]["Enums"]["founder_status"]
          free_pro_ends_at: string | null
          free_pro_starts_at: string | null
          granted_by: string | null
          id: string
          launch_date_used: string | null
          notes: string | null
          override_enabled: boolean
          override_plan_id: string | null
          override_updated_at: string | null
          override_updated_by: string | null
          qualified_at: string
          revoked_at: string | null
          revoked_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          founder_rank: number
          founder_status?: Database["public"]["Enums"]["founder_status"]
          free_pro_ends_at?: string | null
          free_pro_starts_at?: string | null
          granted_by?: string | null
          id?: string
          launch_date_used?: string | null
          notes?: string | null
          override_enabled?: boolean
          override_plan_id?: string | null
          override_updated_at?: string | null
          override_updated_by?: string | null
          qualified_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          founder_rank?: number
          founder_status?: Database["public"]["Enums"]["founder_status"]
          free_pro_ends_at?: string | null
          free_pro_starts_at?: string | null
          granted_by?: string | null
          id?: string
          launch_date_used?: string | null
          notes?: string | null
          override_enabled?: boolean
          override_plan_id?: string | null
          override_updated_at?: string | null
          override_updated_by?: string | null
          qualified_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founding_instructors_override_plan_id_fkey"
            columns: ["override_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      helcim_checkout_sessions: {
        Row: {
          amount_cents: number
          booking_id: string
          checkout_token: string
          confirmed_at: string | null
          created_at: string
          currency: string
          helcim_transaction_id: string | null
          id: string
          raw_response: Json | null
          secret_token: string
          status: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          checkout_token: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          helcim_transaction_id?: string | null
          id?: string
          raw_response?: Json | null
          secret_token: string
          status?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          checkout_token?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          helcim_transaction_id?: string | null
          id?: string
          raw_response?: Json | null
          secret_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "helcim_checkout_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      helcim_webhook_events: {
        Row: {
          attempt_count: number
          booking_id: string | null
          created_at: string
          environment: string
          event_id: string
          event_type: string
          helcim_transaction_id: string | null
          id: string
          last_attempted_at: string | null
          last_error: string | null
          payload: Json
          processing_status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          booking_id?: string | null
          created_at?: string
          environment: string
          event_id: string
          event_type: string
          helcim_transaction_id?: string | null
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          payload: Json
          processing_status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          booking_id?: string | null
          created_at?: string
          environment?: string
          event_id?: string
          event_type?: string
          helcim_transaction_id?: string | null
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          payload?: Json
          processing_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      influencer_commission_pct_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          effective_at: string
          id: string
          link_id: string | null
          new_pct: number | null
          old_pct: number | null
          reason: string | null
          scope: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          link_id?: string | null
          new_pct?: number | null
          old_pct?: number | null
          reason?: string | null
          scope: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          link_id?: string | null
          new_pct?: number | null
          old_pct?: number | null
          reason?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_commission_pct_audit_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_my_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_commission_pct_audit_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_commission_pct_audit_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links_public"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_commissions: {
        Row: {
          amount_cents: number
          booking_id: string
          commission_kind: string
          course_price_cents: number
          created_at: string
          id: string
          link_id: string
          payout_id: string | null
          pct_at_time: number
          signup_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          booking_id: string
          commission_kind?: string
          course_price_cents?: number
          created_at?: string
          id?: string
          link_id: string
          payout_id?: string | null
          pct_at_time: number
          signup_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          commission_kind?: string
          course_price_cents?: number
          created_at?: string
          id?: string
          link_id?: string
          payout_id?: string | null
          pct_at_time?: number
          signup_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_commissions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_my_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_commissions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_commissions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_commissions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "influencer_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_commissions_signup_id_fkey"
            columns: ["signup_id"]
            isOneToOne: false
            referencedRelation: "influencer_link_signups"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_link_redirect_log: {
        Row: {
          audience_on_link: string | null
          created_at: string
          detected_role: string | null
          id: string
          link_id: string | null
          outcome: string
          slug: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          audience_on_link?: string | null
          created_at?: string
          detected_role?: string | null
          id?: string
          link_id?: string | null
          outcome: string
          slug: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          audience_on_link?: string | null
          created_at?: string
          detected_role?: string | null
          id?: string
          link_id?: string | null
          outcome?: string
          slug?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_link_redirect_log_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_my_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_link_redirect_log_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_link_redirect_log_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links_public"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_link_signups: {
        Row: {
          id: string
          link_id: string
          signed_up_at: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          id?: string
          link_id: string
          signed_up_at?: string
          user_id: string
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          id?: string
          link_id?: string
          signed_up_at?: string
          user_id?: string
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_link_signups_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_my_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_link_signups_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_link_signups_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links_public"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_links: {
        Row: {
          access_pin: string | null
          active: boolean
          audience: string
          commission_pct: number | null
          created_at: string
          created_by: string | null
          first_booking_pct: number | null
          id: string
          influencer_email: string | null
          influencer_handle: string | null
          influencer_name: string
          is_vip: boolean
          notes: string | null
          owner_user_id: string | null
          payout_handle: string | null
          payout_method: string | null
          payout_notes: string | null
          recurring_pct: number | null
          recurring_window_days: number | null
          slug: string
          updated_at: string
          vip_duration_days: number | null
          vip_pct: number | null
          vip_starts_at: string | null
        }
        Insert: {
          access_pin?: string | null
          active?: boolean
          audience?: string
          commission_pct?: number | null
          created_at?: string
          created_by?: string | null
          first_booking_pct?: number | null
          id?: string
          influencer_email?: string | null
          influencer_handle?: string | null
          influencer_name: string
          is_vip?: boolean
          notes?: string | null
          owner_user_id?: string | null
          payout_handle?: string | null
          payout_method?: string | null
          payout_notes?: string | null
          recurring_pct?: number | null
          recurring_window_days?: number | null
          slug: string
          updated_at?: string
          vip_duration_days?: number | null
          vip_pct?: number | null
          vip_starts_at?: string | null
        }
        Update: {
          access_pin?: string | null
          active?: boolean
          audience?: string
          commission_pct?: number | null
          created_at?: string
          created_by?: string | null
          first_booking_pct?: number | null
          id?: string
          influencer_email?: string | null
          influencer_handle?: string | null
          influencer_name?: string
          is_vip?: boolean
          notes?: string | null
          owner_user_id?: string | null
          payout_handle?: string | null
          payout_method?: string | null
          payout_notes?: string | null
          recurring_pct?: number | null
          recurring_window_days?: number | null
          slug?: string
          updated_at?: string
          vip_duration_days?: number | null
          vip_pct?: number | null
          vip_starts_at?: string | null
        }
        Relationships: []
      }
      influencer_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          link_id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          link_id: string
          method: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          link_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_payouts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_my_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_payouts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_payouts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "influencer_links_public"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_charges: {
        Row: {
          amount_cents: number
          capacity: number
          charge_type: string
          course_id: string
          course_price_cents: number
          created_at: string
          currency: string
          id: string
          instructor_id: string
          note: string | null
          refundable: boolean
          status: string
        }
        Insert: {
          amount_cents: number
          capacity: number
          charge_type?: string
          course_id: string
          course_price_cents: number
          created_at?: string
          currency?: string
          id?: string
          instructor_id: string
          note?: string | null
          refundable?: boolean
          status?: string
        }
        Update: {
          amount_cents?: number
          capacity?: number
          charge_type?: string
          course_id?: string
          course_price_cents?: number
          created_at?: string
          currency?: string
          id?: string
          instructor_id?: string
          note?: string | null
          refundable?: boolean
          status?: string
        }
        Relationships: []
      }
      instructor_credentials: {
        Row: {
          admin_notes: string | null
          ai_confidence: number | null
          ai_decided_at: string | null
          ai_expires_on: string | null
          ai_holder_name: string | null
          ai_issuer: string | null
          ai_name_match_score: number | null
          ai_raw: Json | null
          ai_reasons: string | null
          created_at: string
          credential_type: string
          display_name: string | null
          expired_at: string | null
          file_mime: string | null
          file_path: string
          id: string
          instructor_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          ai_confidence?: number | null
          ai_decided_at?: string | null
          ai_expires_on?: string | null
          ai_holder_name?: string | null
          ai_issuer?: string | null
          ai_name_match_score?: number | null
          ai_raw?: Json | null
          ai_reasons?: string | null
          created_at?: string
          credential_type: string
          display_name?: string | null
          expired_at?: string | null
          file_mime?: string | null
          file_path: string
          id?: string
          instructor_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          ai_confidence?: number | null
          ai_decided_at?: string | null
          ai_expires_on?: string | null
          ai_holder_name?: string | null
          ai_issuer?: string | null
          ai_name_match_score?: number | null
          ai_raw?: Json | null
          ai_reasons?: string | null
          created_at?: string
          credential_type?: string
          display_name?: string | null
          expired_at?: string | null
          file_mime?: string | null
          file_path?: string
          id?: string
          instructor_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructor_ledger: {
        Row: {
          amount_cents: number
          available_at: string | null
          booking_id: string | null
          created_at: string
          currency: string
          entry_type: string
          external_payout_id: string | null
          id: string
          instructor_id: string
          notes: string | null
          paid_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
        }
        Insert: {
          amount_cents: number
          available_at?: string | null
          booking_id?: string | null
          created_at?: string
          currency?: string
          entry_type: string
          external_payout_id?: string | null
          id?: string
          instructor_id: string
          notes?: string | null
          paid_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
        }
        Update: {
          amount_cents?: number
          available_at?: string | null
          booking_id?: string | null
          created_at?: string
          currency?: string
          entry_type?: string
          external_payout_id?: string | null
          id?: string
          instructor_id?: string
          notes?: string | null
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "instructor_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_ledger_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_ledger_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_ledger_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "public_instructor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_payout_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          external_account_id: string | null
          id: string
          instructor_id: string
          metadata: Json
          payouts_enabled: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          status: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          external_account_id?: string | null
          id?: string
          instructor_id: string
          metadata?: Json
          payouts_enabled?: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          status?: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          external_account_id?: string | null
          id?: string
          instructor_id?: string
          metadata?: Json
          payouts_enabled?: boolean
          provider?: Database["public"]["Enums"]["payment_provider"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_payout_accounts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payout_accounts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payout_accounts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "public_instructor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_payout_methods: {
        Row: {
          created_at: string
          handle: string
          id: string
          instructor_id: string
          is_preferred: boolean
          method_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          instructor_id: string
          is_preferred?: boolean
          method_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          instructor_id?: string
          is_preferred?: boolean
          method_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      issue_clusters: {
        Row: {
          created_at: string
          id: string
          report_count: number
          resolved_at: string | null
          resolved_by: string | null
          root_cause: string | null
          severity: string
          status: string
          suggested_fix: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          suggested_fix?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          report_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          suggested_fix?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      issue_reports: {
        Row: {
          admin_notes: string | null
          category: string
          cluster_id: string | null
          created_at: string
          description: string
          id: string
          page_url: string
          reporter_email: string | null
          reporter_name: string | null
          reporter_role: string | null
          root_cause: string | null
          severity: string
          status: string
          suggested_fix: string | null
          triaged_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          cluster_id?: string | null
          created_at?: string
          description: string
          id?: string
          page_url: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_role?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          suggested_fix?: string | null
          triaged_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          cluster_id?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_role?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          suggested_fix?: string | null
          triaged_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      launch_config: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          bookings_enabled: boolean
          countdown_enabled: boolean
          course_creation_enabled: boolean
          created_at: string
          id: boolean
          last_updated_at: string
          last_updated_by: string | null
          launch_at: string | null
          launch_mode: Database["public"]["Enums"]["app_launch_mode"]
          maintenance_message: string | null
          manual_override: boolean
          pro_unlock_enabled: boolean
          publish_enabled: boolean
          waitlist_enabled: boolean
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          bookings_enabled?: boolean
          countdown_enabled?: boolean
          course_creation_enabled?: boolean
          created_at?: string
          id?: boolean
          last_updated_at?: string
          last_updated_by?: string | null
          launch_at?: string | null
          launch_mode?: Database["public"]["Enums"]["app_launch_mode"]
          maintenance_message?: string | null
          manual_override?: boolean
          pro_unlock_enabled?: boolean
          publish_enabled?: boolean
          waitlist_enabled?: boolean
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          bookings_enabled?: boolean
          countdown_enabled?: boolean
          course_creation_enabled?: boolean
          created_at?: string
          id?: boolean
          last_updated_at?: string
          last_updated_by?: string | null
          launch_at?: string | null
          launch_mode?: Database["public"]["Enums"]["app_launch_mode"]
          maintenance_message?: string | null
          manual_override?: boolean
          pro_unlock_enabled?: boolean
          publish_enabled?: boolean
          waitlist_enabled?: boolean
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          ai_description: string | null
          alt_text: string | null
          analysis_error: string | null
          analyzed_at: string | null
          category: string | null
          created_at: string
          file_size: number | null
          filename: string
          id: string
          mime_type: string
          public_url: string
          seo_score: number
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: string | null
          usage_count: number
        }
        Insert: {
          ai_description?: string | null
          alt_text?: string | null
          analysis_error?: string | null
          analyzed_at?: string | null
          category?: string | null
          created_at?: string
          file_size?: number | null
          filename: string
          id?: string
          mime_type: string
          public_url: string
          seo_score?: number
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          usage_count?: number
        }
        Update: {
          ai_description?: string | null
          alt_text?: string | null
          analysis_error?: string | null
          analyzed_at?: string | null
          category?: string | null
          created_at?: string
          file_size?: number | null
          filename?: string
          id?: string
          mime_type?: string
          public_url?: string
          seo_score?: number
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          usage_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          flag_reason: string | null
          id: string
          is_flagged: boolean
          moderation_reason: string | null
          moderation_severity: string | null
          moderation_status: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          moderation_reason?: string | null
          moderation_severity?: string | null
          moderation_status?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          moderation_reason?: string | null
          moderation_severity?: string | null
          moderation_status?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          cardholder_name: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          handle: string | null
          id: string
          last4: string | null
          method_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          cardholder_name?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          handle?: string | null
          id?: string
          last4?: string | null
          method_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          cardholder_name?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          handle?: string | null
          id?: string
          last4?: string | null
          method_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_provider_settings: {
        Row: {
          active_provider: Database["public"]["Enums"]["payment_provider"]
          authorize_net_configured: boolean
          failover_mode: string
          fallback_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          helcim_configured: boolean
          id: boolean
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_provider?: Database["public"]["Enums"]["payment_provider"]
          authorize_net_configured?: boolean
          failover_mode?: string
          fallback_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          helcim_configured?: boolean
          id?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_provider?: Database["public"]["Enums"]["payment_provider"]
          authorize_net_configured?: boolean
          failover_mode?: string
          fallback_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          helcim_configured?: boolean
          id?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      policy_acknowledgments: {
        Row: {
          created_at: string
          id: string
          ip_hint: string | null
          policy_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hint?: string | null
          policy_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hint?: string | null
          policy_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          bio: string | null
          created_at: string
          credential_uploaded_at: string | null
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          display_name: string | null
          final_warning_sent_at: string | null
          id: string
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          payment_method_added: boolean
          phone: string | null
          photo_url: string | null
          policy_acknowledged_at: string | null
          service_categories: string[] | null
          service_city: string | null
          service_state: string | null
          state: string | null
          strike_points: number
          stripe_connect_account_id: string | null
          stripe_connect_status: string
          subscription_chosen_at: string | null
          subscription_status: string
          subscription_updated_at: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          bio?: string | null
          created_at?: string
          credential_uploaded_at?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          display_name?: string | null
          final_warning_sent_at?: string | null
          id: string
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          payment_method_added?: boolean
          phone?: string | null
          photo_url?: string | null
          policy_acknowledged_at?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
          state?: string | null
          strike_points?: number
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string
          subscription_chosen_at?: string | null
          subscription_status?: string
          subscription_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          bio?: string | null
          created_at?: string
          credential_uploaded_at?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          display_name?: string | null
          final_warning_sent_at?: string | null
          id?: string
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          payment_method_added?: boolean
          phone?: string | null
          photo_url?: string | null
          policy_acknowledged_at?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
          state?: string | null
          strike_points?: number
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string
          subscription_chosen_at?: string | null
          subscription_status?: string
          subscription_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proximity_events: {
        Row: {
          accuracy_m: number | null
          booking_id: string
          course_id: string
          created_at: string
          distance_m: number | null
          id: string
          metadata: Json
          smoothed_m: number | null
          source: string
          student_id: string
          verified: boolean
        }
        Insert: {
          accuracy_m?: number | null
          booking_id: string
          course_id: string
          created_at?: string
          distance_m?: number | null
          id?: string
          metadata?: Json
          smoothed_m?: number | null
          source?: string
          student_id: string
          verified?: boolean
        }
        Update: {
          accuracy_m?: number | null
          booking_id?: string
          course_id?: string
          created_at?: string
          distance_m?: number | null
          id?: string
          metadata?: Json
          smoothed_m?: number | null
          source?: string
          student_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      proximity_token_nonces: {
        Row: {
          booking_id: string
          consumed_at: string | null
          consumed_by_instructor: string | null
          device_id: string
          expires_at: string
          issued_at: string
          nonce: string
          student_id: string
        }
        Insert: {
          booking_id: string
          consumed_at?: string | null
          consumed_by_instructor?: string | null
          device_id: string
          expires_at: string
          issued_at?: string
          nonce: string
          student_id: string
        }
        Update: {
          booking_id?: string
          consumed_at?: string | null
          consumed_by_instructor?: string | null
          device_id?: string
          expires_at?: string
          issued_at?: string
          nonce?: string
          student_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
          user_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code_used: string
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
          referrer_role: Database["public"]["Enums"]["app_role"]
          reward_id: string | null
          reward_type: string | null
          rewarded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code_used: string
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
          referrer_role: Database["public"]["Enums"]["app_role"]
          reward_id?: string | null
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code_used?: string
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
          referrer_role?: Database["public"]["Enums"]["app_role"]
          reward_id?: string | null
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      refund_test_runs: {
        Row: {
          after_snapshot: Json | null
          amount_cents: number
          before_snapshot: Json
          booking_id: string
          booking_updated: boolean
          checks: Json
          completed_at: string | null
          created_at: string
          environment: string
          error_message: string | null
          helcim_refund_response: Json | null
          helcim_refund_txn_id: string | null
          helcim_transaction_id: string | null
          id: string
          ledger_reversed: boolean
          refund_id: string | null
          refund_row_updated: boolean
          started_by: string
          status: string
          updated_at: string
          webhook_event_id: string | null
          webhook_received: boolean
          webhook_signature_valid: boolean | null
        }
        Insert: {
          after_snapshot?: Json | null
          amount_cents?: number
          before_snapshot?: Json
          booking_id: string
          booking_updated?: boolean
          checks?: Json
          completed_at?: string | null
          created_at?: string
          environment?: string
          error_message?: string | null
          helcim_refund_response?: Json | null
          helcim_refund_txn_id?: string | null
          helcim_transaction_id?: string | null
          id?: string
          ledger_reversed?: boolean
          refund_id?: string | null
          refund_row_updated?: boolean
          started_by: string
          status?: string
          updated_at?: string
          webhook_event_id?: string | null
          webhook_received?: boolean
          webhook_signature_valid?: boolean | null
        }
        Update: {
          after_snapshot?: Json | null
          amount_cents?: number
          before_snapshot?: Json
          booking_id?: string
          booking_updated?: boolean
          checks?: Json
          completed_at?: string | null
          created_at?: string
          environment?: string
          error_message?: string | null
          helcim_refund_response?: Json | null
          helcim_refund_txn_id?: string | null
          helcim_transaction_id?: string | null
          id?: string
          ledger_reversed?: boolean
          refund_id?: string | null
          refund_row_updated?: boolean
          started_by?: string
          status?: string
          updated_at?: string
          webhook_event_id?: string | null
          webhook_received?: boolean
          webhook_signature_valid?: boolean | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          ai_action_id: string | null
          amount_cents: number
          auto_issued: boolean
          booking_id: string
          created_at: string
          dispute_window_until: string | null
          external_reference: string | null
          hours_before_course: number | null
          id: string
          instructor_dispute_reason: string | null
          instructor_disputed_at: string | null
          instructor_forfeit_cents: number
          issued_by: string
          notes: string | null
          platform_absorbed_cents: number
          reason: string
          refund_method: string
          refund_reason_category: string | null
          refund_type: string
          risk_factors: Json | null
          risk_score: number | null
          status: string
          stripe_refund_id: string | null
          stripe_refund_status: string | null
          student_cash_refund_cents: number
          student_id: string
          updated_at: string
        }
        Insert: {
          ai_action_id?: string | null
          amount_cents: number
          auto_issued?: boolean
          booking_id: string
          created_at?: string
          dispute_window_until?: string | null
          external_reference?: string | null
          hours_before_course?: number | null
          id?: string
          instructor_dispute_reason?: string | null
          instructor_disputed_at?: string | null
          instructor_forfeit_cents?: number
          issued_by: string
          notes?: string | null
          platform_absorbed_cents?: number
          reason: string
          refund_method?: string
          refund_reason_category?: string | null
          refund_type: string
          risk_factors?: Json | null
          risk_score?: number | null
          status?: string
          stripe_refund_id?: string | null
          stripe_refund_status?: string | null
          student_cash_refund_cents?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          ai_action_id?: string | null
          amount_cents?: number
          auto_issued?: boolean
          booking_id?: string
          created_at?: string
          dispute_window_until?: string | null
          external_reference?: string | null
          hours_before_course?: number | null
          id?: string
          instructor_dispute_reason?: string | null
          instructor_disputed_at?: string | null
          instructor_forfeit_cents?: number
          issued_by?: string
          notes?: string | null
          platform_absorbed_cents?: number
          reason?: string
          refund_method?: string
          refund_reason_category?: string | null
          refund_type?: string
          risk_factors?: Json | null
          risk_score?: number | null
          status?: string
          stripe_refund_id?: string | null
          stripe_refund_status?: string | null
          student_cash_refund_cents?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          instructor_id: string
          instructor_reply: string | null
          instructor_reply_at: string | null
          photo_url: string | null
          rating: number
          student_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          instructor_id: string
          instructor_reply?: string | null
          instructor_reply_at?: string | null
          photo_url?: string | null
          rating: number
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
          instructor_reply?: string | null
          instructor_reply_at?: string | null
          photo_url?: string | null
          rating?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      route_404_events: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          release_id: string | null
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          release_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          release_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      route_404_resolutions: {
        Row: {
          id: string
          notes: string | null
          path: string
          release_id: string | null
          resolved_at: string
          resolved_by: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          path: string
          release_id?: string | null
          resolved_at?: string
          resolved_by?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          path?: string
          release_id?: string | null
          resolved_at?: string
          resolved_by?: string | null
        }
        Relationships: []
      }
      seo_articles: {
        Row: {
          body_markdown: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          keywords: string[]
          meta_description: string | null
          model: string | null
          published_at: string | null
          slug: string
          status: string
          target_keyword: string | null
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          body_markdown?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          keywords?: string[]
          meta_description?: string | null
          model?: string | null
          published_at?: string | null
          slug: string
          status?: string
          target_keyword?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          body_markdown?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          keywords?: string[]
          meta_description?: string | null
          model?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          target_keyword?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_articles_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "seo_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_topics: {
        Row: {
          article_id: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          notes: string | null
          status: string
          target_keyword: string | null
          title: string
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          target_keyword?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          target_keyword?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      smoke_test_findings: {
        Row: {
          auto_fixed: boolean
          category: string
          check_name: string
          created_at: string
          detail: string | null
          fix_notes: string | null
          id: string
          run_id: string
          status: string
          target: string | null
        }
        Insert: {
          auto_fixed?: boolean
          category: string
          check_name: string
          created_at?: string
          detail?: string | null
          fix_notes?: string | null
          id?: string
          run_id: string
          status: string
          target?: string | null
        }
        Update: {
          auto_fixed?: boolean
          category?: string
          check_name?: string
          created_at?: string
          detail?: string | null
          fix_notes?: string | null
          id?: string
          run_id?: string
          status?: string
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smoke_test_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "smoke_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      smoke_test_runs: {
        Row: {
          auto_fixed: number
          duration_ms: number | null
          failed: number
          finished_at: string | null
          id: string
          passed: number
          started_at: string
          status: string
          summary: Json | null
          total_checks: number
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          auto_fixed?: number
          duration_ms?: number | null
          failed?: number
          finished_at?: string | null
          id?: string
          passed?: number
          started_at?: string
          status?: string
          summary?: Json | null
          total_checks?: number
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Update: {
          auto_fixed?: number
          duration_ms?: number | null
          failed?: number
          finished_at?: string | null
          id?: string
          passed?: number
          started_at?: string
          status?: string
          summary?: Json | null
          total_checks?: number
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          environment: string
          event_id: string
          event_type: string
          payload: Json | null
          processed_at: string
        }
        Insert: {
          environment: string
          event_id: string
          event_type: string
          payload?: Json | null
          processed_at?: string
        }
        Update: {
          environment?: string
          event_id?: string
          event_type?: string
          payload?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
      student_onboarding: {
        Row: {
          checklist: Json
          checklist_dismissed: boolean
          created_at: string
          experience_level: string | null
          notif_prompt_shown: boolean
          quiz_completed_at: string | null
          selected_pillars: string[] | null
          tooltips_seen: string[]
          training_goal: string | null
          travel_radius_miles: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: Json
          checklist_dismissed?: boolean
          created_at?: string
          experience_level?: string | null
          notif_prompt_shown?: boolean
          quiz_completed_at?: string | null
          selected_pillars?: string[] | null
          tooltips_seen?: string[]
          training_goal?: string | null
          travel_radius_miles?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist?: Json
          checklist_dismissed?: boolean
          created_at?: string
          experience_level?: string | null
          notif_prompt_shown?: boolean
          quiz_completed_at?: string | null
          selected_pillars?: string[] | null
          tooltips_seen?: string[]
          training_goal?: string | null
          travel_radius_miles?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_xp_awards: {
        Row: {
          base_xp: number
          bonus_first_mission: number
          bonus_five_star: number
          bonus_full_day: number
          bonus_multi_day: number
          booking_id: string
          course_id: string
          created_at: string
          id: string
          is_secondary: boolean
          pillar: Database["public"]["Enums"]["skill_pillar"]
          student_id: string
          updated_at: string
          xp: number
        }
        Insert: {
          base_xp?: number
          bonus_first_mission?: number
          bonus_five_star?: number
          bonus_full_day?: number
          bonus_multi_day?: number
          booking_id: string
          course_id: string
          created_at?: string
          id?: string
          is_secondary?: boolean
          pillar: Database["public"]["Enums"]["skill_pillar"]
          student_id: string
          updated_at?: string
          xp: number
        }
        Update: {
          base_xp?: number
          bonus_first_mission?: number
          bonus_five_star?: number
          bonus_full_day?: number
          bonus_multi_day?: number
          booking_id?: string
          course_id?: string
          created_at?: string
          id?: string
          is_secondary?: boolean
          pillar?: Database["public"]["Enums"]["skill_pillar"]
          student_id?: string
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          ai_validated_at: string | null
          ai_validation: Json | null
          audience: string
          billing_interval: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          features: Json
          highlight: boolean
          id: string
          locked: boolean
          locked_at: string | null
          locked_reason: string | null
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_validated_at?: string | null
          ai_validation?: Json | null
          audience?: string
          billing_interval?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          features?: Json
          highlight?: boolean
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_reason?: string | null
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_validated_at?: string | null
          ai_validation?: Json | null
          audience?: string
          billing_interval?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          features?: Json
          highlight?: boolean
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_reason?: string | null
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          helcim_subscription_id: string | null
          id: string
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          helcim_subscription_id?: string | null
          id?: string
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          helcim_subscription_id?: string | null
          id?: string
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender: Database["public"]["Enums"]["support_message_sender"]
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender: Database["public"]["Enums"]["support_message_sender"]
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender?: Database["public"]["Enums"]["support_message_sender"]
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          initial_message: string
          last_message_at: string
          needs_human: boolean
          page_url: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          initial_message: string
          last_message_at?: string
          needs_human?: boolean
          page_url?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          initial_message?: string
          last_message_at?: string
          needs_human?: boolean
          page_url?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
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
      test_accounts: {
        Row: {
          created_at: string
          created_by: string
          email: string
          id: string
          label: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          id?: string
          label?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          label?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      training_goal_events: {
        Row: {
          created_at: string
          event_type: string
          goal_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          goal_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          goal_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_goal_events_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "training_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      training_goals: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_manually: boolean
          created_at: string
          deadline: string | null
          description: string | null
          goal_type: Database["public"]["Enums"]["training_goal_type"]
          id: string
          student_id: string
          target_count: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_manually?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["training_goal_type"]
          id?: string
          student_id: string
          target_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_manually?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["training_goal_type"]
          id?: string
          student_id?: string
          target_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      uptime_checks: {
        Row: {
          checked_at: string
          error: string | null
          http_status: number | null
          id: string
          monitor_id: string
          response_ms: number | null
          ssl_days_remaining: number | null
          status: string
        }
        Insert: {
          checked_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          monitor_id: string
          response_ms?: number | null
          ssl_days_remaining?: number | null
          status: string
        }
        Update: {
          checked_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          monitor_id?: string
          response_ms?: number | null
          ssl_days_remaining?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "uptime_checks_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "uptime_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      uptime_monitors: {
        Row: {
          active: boolean
          alert_emails: string[]
          alert_threshold: number
          consecutive_failures: number
          created_at: string
          expected_status: number
          id: string
          interval_minutes: number
          last_alert_sent_at: string | null
          last_checked_at: string | null
          last_error: string | null
          last_status: string | null
          name: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          alert_emails?: string[]
          alert_threshold?: number
          consecutive_failures?: number
          created_at?: string
          expected_status?: number
          id?: string
          interval_minutes?: number
          last_alert_sent_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_status?: string | null
          name: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          alert_emails?: string[]
          alert_threshold?: number
          consecutive_failures?: number
          created_at?: string
          expected_status?: number
          id?: string
          interval_minutes?: number
          last_alert_sent_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_status?: string | null
          name?: string
          updated_at?: string
          url?: string
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
      waiver_signatures: {
        Row: {
          booking_id: string
          course_id: string
          created_at: string
          esign_consent_acknowledged: boolean
          esign_consent_initials: string | null
          esign_disclosure_version: string | null
          guardian_full_name: string | null
          guardian_relationship: string | null
          guardian_signed_at: string | null
          id: string
          ip_hint: string | null
          is_minor: boolean
          signed_at: string
          signed_full_name: string
          student_date_of_birth: string | null
          student_id: string
          user_agent: string | null
          waiver_content_snapshot: string
          waiver_id: string
          waiver_version: number
        }
        Insert: {
          booking_id: string
          course_id: string
          created_at?: string
          esign_consent_acknowledged?: boolean
          esign_consent_initials?: string | null
          esign_disclosure_version?: string | null
          guardian_full_name?: string | null
          guardian_relationship?: string | null
          guardian_signed_at?: string | null
          id?: string
          ip_hint?: string | null
          is_minor?: boolean
          signed_at?: string
          signed_full_name: string
          student_date_of_birth?: string | null
          student_id: string
          user_agent?: string | null
          waiver_content_snapshot: string
          waiver_id: string
          waiver_version: number
        }
        Update: {
          booking_id?: string
          course_id?: string
          created_at?: string
          esign_consent_acknowledged?: boolean
          esign_consent_initials?: string | null
          esign_disclosure_version?: string | null
          guardian_full_name?: string | null
          guardian_relationship?: string | null
          guardian_signed_at?: string | null
          id?: string
          ip_hint?: string | null
          is_minor?: boolean
          signed_at?: string
          signed_full_name?: string
          student_date_of_birth?: string | null
          student_id?: string
          user_agent?: string | null
          waiver_content_snapshot?: string
          waiver_id?: string
          waiver_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiver_signatures_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "course_waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      warrior_quote_settings: {
        Row: {
          display_style: string
          enabled: boolean
          id: number
          opacity: number
          rotation: string
          show_to_instructors: boolean
          show_to_students: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          display_style?: string
          enabled?: boolean
          id?: number
          opacity?: number
          rotation?: string
          show_to_instructors?: boolean
          show_to_students?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          display_style?: string
          enabled?: boolean
          id?: number
          opacity?: number
          rotation?: string
          show_to_instructors?: boolean
          show_to_students?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      warrior_quotes: {
        Row: {
          author: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          source_note: string | null
          text: string
          updated_at: string
        }
        Insert: {
          author: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          source_note?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          author?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          source_note?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      affiliate_my_link: {
        Row: {
          active: boolean | null
          audience: string | null
          created_at: string | null
          id: string | null
          influencer_handle: string | null
          influencer_name: string | null
          is_vip: boolean | null
          owner_user_id: string | null
          payout_handle: string | null
          payout_method: string | null
          payout_notes: string | null
          slug: string | null
          updated_at: string | null
          vip_duration_days: number | null
          vip_starts_at: string | null
        }
        Insert: {
          active?: boolean | null
          audience?: string | null
          created_at?: string | null
          id?: string | null
          influencer_handle?: string | null
          influencer_name?: string | null
          is_vip?: boolean | null
          owner_user_id?: string | null
          payout_handle?: string | null
          payout_method?: string | null
          payout_notes?: string | null
          slug?: string | null
          updated_at?: string | null
          vip_duration_days?: number | null
          vip_starts_at?: string | null
        }
        Update: {
          active?: boolean | null
          audience?: string | null
          created_at?: string | null
          id?: string | null
          influencer_handle?: string | null
          influencer_name?: string | null
          is_vip?: boolean | null
          owner_user_id?: string | null
          payout_handle?: string | null
          payout_method?: string | null
          payout_notes?: string | null
          slug?: string | null
          updated_at?: string | null
          vip_duration_days?: number | null
          vip_starts_at?: string | null
        }
        Relationships: []
      }
      influencer_links_public: {
        Row: {
          active: boolean | null
          audience: string | null
          created_at: string | null
          id: string | null
          slug: string | null
        }
        Insert: {
          active?: boolean | null
          audience?: string | null
          created_at?: string | null
          id?: string | null
          slug?: string | null
        }
        Update: {
          active?: boolean | null
          audience?: string | null
          created_at?: string | null
          id?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          photo_url: string | null
          service_categories: string[] | null
          service_city: string | null
          service_state: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          photo_url?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          photo_url?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
        }
        Relationships: []
      }
      public_instructor_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          photo_url: string | null
          service_categories: string[] | null
          service_city: string | null
          service_state: string | null
          state: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          photo_url?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
          state?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          photo_url?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
          state?: string | null
        }
        Relationships: []
      }
      student_pillar_xp_v: {
        Row: {
          awards_count: number | null
          pillar: Database["public"]["Enums"]["skill_pillar"] | null
          student_id: string | null
          total_xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_launch_if_due: { Args: never; Returns: Json }
      activate_pending_founders: {
        Args: { _launch_at: string }
        Returns: number
      }
      admin_grant_founder: {
        Args: { _note?: string; _user_id: string }
        Returns: Json
      }
      admin_revoke_founder: {
        Args: { _reason: string; _user_id: string }
        Returns: Json
      }
      admin_set_founder_access: {
        Args: {
          _enabled: boolean
          _ends_at: string
          _note?: string
          _plan_id: string
          _starts_at: string
          _user_id: string
        }
        Returns: Json
      }
      admin_toggle_founder_access: {
        Args: { _enabled: boolean; _user_id: string }
        Returns: Json
      }
      audit_booking_action: {
        Args: {
          _action: string
          _after: Json
          _before: Json
          _booking_id: string
          _reason?: string
        }
        Returns: undefined
      }
      award_pillar_xp_for_booking: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      award_strike: {
        Args: { _points?: number; _user_id: string }
        Returns: {
          new_points: number
          new_status: string
          suspended: boolean
          warning_issued: boolean
        }[]
      }
      check_influencer_slug_available: {
        Args: { _slug: string }
        Returns: Json
      }
      compute_cancel_cutoff_hours: {
        Args: { _booked_at: string; _starts_at: string }
        Returns: number
      }
      compute_refund_split: {
        Args: { _booking_id: string; _reason: string }
        Returns: {
          hours_before_course: number
          instructor_forfeit_cents: number
          platform_absorbed_cents: number
          rationale: string
          reason_category: string
          requires_owner: boolean
          student_cash_refund_cents: number
        }[]
      }
      compute_student_risk_score: {
        Args: { _student_id: string }
        Returns: {
          factors: Json
          score: number
        }[]
      }
      current_dev_user_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_founders_due: { Args: never; Returns: number }
      expire_stale_credentials: { Args: never; Returns: number }
      generate_access_pin: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_active_payment_provider: { Args: never; Returns: string }
      get_effective_launch_state: { Args: never; Returns: Json }
      get_founder_program_stats: { Args: never; Returns: Json }
      get_guest_affiliate_stats: {
        Args: { _pin: string; _slug: string }
        Returns: Json
      }
      get_my_founder_status: { Args: never; Returns: Json }
      get_public_founder_badge: {
        Args: { _user_id: string }
        Returns: {
          founder_rank: number
          founder_status: Database["public"]["Enums"]["founder_status"]
          user_id: string
        }[]
      }
      get_public_founder_badges: {
        Args: { _user_ids: string[] }
        Returns: {
          founder_rank: number
          founder_status: Database["public"]["Enums"]["founder_status"]
          user_id: string
        }[]
      }
      get_public_profile_cards: {
        Args: { _ids: string[] }
        Returns: {
          display_name: string
          id: string
          photo_url: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_pro_access: {
        Args: { _env?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      influencer_link_vip_active: {
        Args: { _link: Database["public"]["Tables"]["influencer_links"]["Row"] }
        Returns: boolean
      }
      instructor_cancel_course: {
        Args: { _course_id: string; _reason?: string }
        Returns: {
          bookings_refunded: number
          course_id: string
          hours_before_start: number
          instructor_forfeited_cents: number
          listing_fee_refunded_cents: number
          total_refunded_cents: number
          was_timely: boolean
        }[]
      }
      instructor_choose_free_plan: { Args: never; Returns: undefined }
      instructor_dispute_refund: {
        Args: { _reason: string; _refund_id: string }
        Returns: Json
      }
      instructor_has_approved_credential: {
        Args: { _user_id: string }
        Returns: boolean
      }
      instructor_no_show_refund: {
        Args: { _booking_id: string; _reason?: string }
        Returns: Json
      }
      instructor_onboarding_status: {
        Args: { _user_id: string }
        Returns: {
          complete: boolean
          has_credential: boolean
          has_policy_ack: boolean
          has_subscription: boolean
          next_step: string
          started_at: string
        }[]
      }
      instructor_owed_balance_cents: {
        Args: {
          _instructor_id: string
          _provider: Database["public"]["Enums"]["payment_provider"]
        }
        Returns: number
      }
      is_influencer_slug_available: {
        Args: { _slug: string }
        Returns: boolean
      }
      is_test_account: { Args: { _user_id: string }; Returns: boolean }
      list_due_attendance_claims: {
        Args: never
        Returns: {
          booking_id: string
          claim_id: string
          instructor_id: string
          student_id: string
        }[]
      }
      list_releasable_deposits: {
        Args: never
        Returns: {
          booking_id: string
          course_ended_at: string
          course_id: string
          deposit_amount_cents: number
          instructor_id: string
        }[]
      }
      list_stale_instructor_onboarders: {
        Args: { _older_than_hours?: number }
        Returns: {
          email: string
          started_at: string
          user_id: string
        }[]
      }
      log_admin_action: {
        Args: {
          _action: string
          _after: Json
          _before: Json
          _reason?: string
          _source?: string
          _target_id: string
          _target_type: string
        }
        Returns: string
      }
      lookup_referral_code: {
        Args: { _code: string }
        Returns: {
          display_name: string
          user_role: string
        }[]
      }
      mark_influencer_commissions_paid: {
        Args: {
          _commission_ids: string[]
          _link_id: string
          _method: string
          _notes?: string
          _paid_at?: string
          _reference?: string
        }
        Returns: string
      }
      maybe_complete_instructor_onboarding: {
        Args: { _user_id: string }
        Returns: undefined
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
      normalize_influencer_slug: { Args: { _raw: string }; Returns: string }
      qualify_founding_instructor: { Args: { _user_id: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_checkin_attempt: {
        Args: {
          _booking_id?: string
          _course_id: string
          _outcome: string
          _reason?: string
          _source?: string
        }
        Returns: string
      }
      referral_code_exists: { Args: { _code: string }; Returns: boolean }
      regenerate_affiliate_access_pin: {
        Args: { _link_id: string }
        Returns: string
      }
      student_cancel_booking: {
        Args: { _booking_id: string; _reason?: string }
        Returns: Json
      }
      student_no_show_refund: {
        Args: { _booking_id: string; _reason?: string }
        Returns: Json
      }
      update_guest_affiliate_payout: {
        Args: {
          _handle: string
          _method: string
          _notes?: string
          _pin: string
          _slug: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_launch_mode: "prelaunch" | "live" | "paused"
      app_role: "student" | "instructor" | "admin"
      booking_status: "reserved" | "attended" | "cancelled" | "no_show"
      founder_status: "pending_prelaunch" | "active" | "expired" | "revoked"
      payment_provider: "stripe" | "authorize_net" | "helcim"
      skill_pillar:
        | "firearms"
        | "combatives"
        | "protective_ops"
        | "fieldcraft"
        | "medical"
        | "tactics"
      support_message_sender: "user" | "ai" | "admin"
      support_ticket_status: "open" | "awaiting_human" | "resolved" | "closed"
      training_goal_type:
        | "course_count"
        | "category_count"
        | "specific_category"
        | "custom"
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
      app_launch_mode: ["prelaunch", "live", "paused"],
      app_role: ["student", "instructor", "admin"],
      booking_status: ["reserved", "attended", "cancelled", "no_show"],
      founder_status: ["pending_prelaunch", "active", "expired", "revoked"],
      payment_provider: ["stripe", "authorize_net", "helcim"],
      skill_pillar: [
        "firearms",
        "combatives",
        "protective_ops",
        "fieldcraft",
        "medical",
        "tactics",
      ],
      support_message_sender: ["user", "ai", "admin"],
      support_ticket_status: ["open", "awaiting_human", "resolved", "closed"],
      training_goal_type: [
        "course_count",
        "category_count",
        "specific_category",
        "custom",
      ],
    },
  },
} as const
