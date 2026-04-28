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
          course_id: string
          course_price_cents: number
          created_at: string
          due_in_person_cents: number
          id: string
          in_person_paid_at: string | null
          instructor_deposit_cents: number
          online_total_cents: number
          platform_fee_cents: number
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          attended_at?: string | null
          booked_at?: string
          course_id: string
          course_price_cents?: number
          created_at?: string
          due_in_person_cents?: number
          id?: string
          in_person_paid_at?: string | null
          instructor_deposit_cents?: number
          online_total_cents?: number
          platform_fee_cents?: number
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          attended_at?: string | null
          booked_at?: string
          course_id?: string
          course_price_cents?: number
          created_at?: string
          due_in_person_cents?: number
          id?: string
          in_person_paid_at?: string | null
          instructor_deposit_cents?: number
          online_total_cents?: number
          platform_fee_cents?: number
          status?: Database["public"]["Enums"]["booking_status"]
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
          id: string
          instructor_id: string
          lat: number | null
          lng: number | null
          location_name: string | null
          moderation_reason: string | null
          moderation_severity: string | null
          moderation_status: string
          price_cents: number
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
          id?: string
          instructor_id: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          moderation_reason?: string | null
          moderation_severity?: string | null
          moderation_status?: string
          price_cents?: number
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
          id?: string
          instructor_id?: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          moderation_reason?: string | null
          moderation_severity?: string | null
          moderation_status?: string
          price_cents?: number
          starts_at?: string | null
          state?: string | null
          status?: string
          title?: string
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
          ai_expires_on: string | null
          ai_holder_name: string | null
          ai_issuer: string | null
          ai_raw: Json | null
          ai_reasons: string | null
          created_at: string
          credential_type: string
          display_name: string | null
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
          ai_expires_on?: string | null
          ai_holder_name?: string | null
          ai_issuer?: string | null
          ai_raw?: Json | null
          ai_reasons?: string | null
          created_at?: string
          credential_type: string
          display_name?: string | null
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
          ai_expires_on?: string | null
          ai_holder_name?: string | null
          ai_issuer?: string | null
          ai_raw?: Json | null
          ai_reasons?: string | null
          created_at?: string
          credential_type?: string
          display_name?: string | null
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
      issue_reports: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string
          id: string
          page_url: string
          reporter_email: string | null
          reporter_name: string | null
          reporter_role: string | null
          severity: string
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          page_url: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_role?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          page_url?: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_role?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
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
          brand: string
          cardholder_name: string
          created_at: string
          exp_month: number
          exp_year: number
          id: string
          last4: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand: string
          cardholder_name: string
          created_at?: string
          exp_month: number
          exp_year: number
          id?: string
          last4: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          cardholder_name?: string
          created_at?: string
          exp_month?: number
          exp_year?: number
          id?: string
          last4?: string
          updated_at?: string
          user_id?: string
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
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          payment_method_added: boolean
          phone: string | null
          photo_url: string | null
          service_categories: string[] | null
          service_city: string | null
          service_state: string | null
          state: string | null
          subscription_status: string
          subscription_updated_at: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          payment_method_added?: boolean
          phone?: string | null
          photo_url?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
          state?: string | null
          subscription_status?: string
          subscription_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          payment_method_added?: boolean
          phone?: string | null
          photo_url?: string | null
          service_categories?: string[] | null
          service_city?: string | null
          service_state?: string | null
          state?: string | null
          subscription_status?: string
          subscription_updated_at?: string | null
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
          id: string
          ip_hint: string | null
          signed_at: string
          signed_full_name: string
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
          id?: string
          ip_hint?: string | null
          signed_at?: string
          signed_full_name: string
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
          id?: string
          ip_hint?: string | null
          signed_at?: string
          signed_full_name?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_dev_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "instructor" | "admin"
      booking_status: "reserved" | "attended" | "cancelled" | "no_show"
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
      app_role: ["student", "instructor", "admin"],
      booking_status: ["reserved", "attended", "cancelled", "no_show"],
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
