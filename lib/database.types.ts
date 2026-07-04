// Generated from the live Supabase project via the MCP
// generate_typescript_types tool, kept in sync with supabase/migrations.
// Convenience aliases used across the app are appended at the bottom.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity: {
        Row: {
          author_id: string | null;
          content: string;
          created_at: string;
          external_thread_ref: string | null;
          id: string;
          project_id: string;
          studio_id: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Insert: {
          author_id?: string | null;
          content: string;
          created_at?: string;
          external_thread_ref?: string | null;
          id?: string;
          project_id: string;
          studio_id: string;
          type?: Database["public"]["Enums"]["activity_type"];
        };
        Update: {
          author_id?: string | null;
          content?: string;
          created_at?: string;
          external_thread_ref?: string | null;
          id?: string;
          project_id?: string;
          studio_id?: string;
          type?: Database["public"]["Enums"]["activity_type"];
        };
        Relationships: [
          {
            foreignKeyName: "activity_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      approvals: {
        Row: {
          comments: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          review_link_id: string | null;
          reviewer_contact_id: string | null;
          reviewer_name: string | null;
          reviewer_user_id: string | null;
          status: Database["public"]["Enums"]["approval_status"];
          studio_id: string;
          target_id: string;
          target_type: Database["public"]["Enums"]["approval_target"];
          updated_at: string;
        };
        Insert: {
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          review_link_id?: string | null;
          reviewer_contact_id?: string | null;
          reviewer_name?: string | null;
          reviewer_user_id?: string | null;
          status?: Database["public"]["Enums"]["approval_status"];
          studio_id: string;
          target_id: string;
          target_type: Database["public"]["Enums"]["approval_target"];
          updated_at?: string;
        };
        Update: {
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          review_link_id?: string | null;
          reviewer_contact_id?: string | null;
          reviewer_name?: string | null;
          reviewer_user_id?: string | null;
          status?: Database["public"]["Enums"]["approval_status"];
          studio_id?: string;
          target_id?: string;
          target_type?: Database["public"]["Enums"]["approval_target"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_reviewer_contact_id_fkey";
            columns: ["reviewer_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          created_at: string;
          created_by: string | null;
          current_version_id: string | null;
          external_ref: Json | null;
          id: string;
          name: string;
          project_id: string;
          source: string | null;
          status: Database["public"]["Enums"]["asset_status"];
          studio_id: string;
          type: Database["public"]["Enums"]["asset_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          external_ref?: Json | null;
          id?: string;
          name: string;
          project_id: string;
          source?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          studio_id: string;
          type?: Database["public"]["Enums"]["asset_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          external_ref?: Json | null;
          id?: string;
          name?: string;
          project_id?: string;
          source?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          studio_id?: string;
          type?: Database["public"]["Enums"]["asset_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      boards: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string | null;
          name: string;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id?: string | null;
          name: string;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string | null;
          name?: string;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      board_items: {
        Row: {
          id: string;
          studio_id: string;
          board_id: string;
          kind: string;
          name: string | null;
          mime_type: string | null;
          storage_path: string | null;
          url: string | null;
          text: string | null;
          hue: string | null;
          x: number;
          y: number;
          w: number;
          h: number;
          z: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          board_id: string;
          kind?: string;
          name?: string | null;
          mime_type?: string | null;
          storage_path?: string | null;
          url?: string | null;
          text?: string | null;
          hue?: string | null;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          z?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          board_id?: string;
          kind?: string;
          name?: string | null;
          mime_type?: string | null;
          storage_path?: string | null;
          url?: string | null;
          text?: string | null;
          hue?: string | null;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          z?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      brief_attachments: {
        Row: {
          brief_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          mime_type: string | null;
          name: string;
          size_bytes: number | null;
          storage_path: string | null;
          studio_id: string;
        };
        Insert: {
          brief_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mime_type?: string | null;
          name: string;
          size_bytes?: number | null;
          storage_path?: string | null;
          studio_id: string;
        };
        Update: {
          brief_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mime_type?: string | null;
          name?: string;
          size_bytes?: number | null;
          storage_path?: string | null;
          studio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brief_attachments_brief_id_fkey";
            columns: ["brief_id"];
            isOneToOne: false;
            referencedRelation: "briefs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brief_attachments_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      briefs: {
        Row: {
          content: string | null;
          created_at: string;
          id: string;
          project_id: string;
          studio_id: string;
          updated_at: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          id?: string;
          project_id: string;
          studio_id: string;
          updated_at?: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          studio_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "briefs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "briefs_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          created_at: string;
          external_ref: Json | null;
          id: string;
          name: string;
          notes: string | null;
          studio_id: string;
          type: Database["public"]["Enums"]["client_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          external_ref?: Json | null;
          id?: string;
          name: string;
          notes?: string | null;
          studio_id: string;
          type?: Database["public"]["Enums"]["client_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          external_ref?: Json | null;
          id?: string;
          name?: string;
          notes?: string | null;
          studio_id?: string;
          type?: Database["public"]["Enums"]["client_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          client_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          lead_id: string | null;
          name: string;
          phone: string | null;
          role: string | null;
          studio_id: string;
          updated_at: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          lead_id?: string | null;
          name: string;
          phone?: string | null;
          role?: string | null;
          studio_id: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          lead_id?: string | null;
          name?: string;
          phone?: string | null;
          role?: string | null;
          studio_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      email_accounts: {
        Row: {
          id: string;
          studio_id: string;
          user_id: string;
          provider: string;
          email: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expiry: string | null;
          scope: string | null;
          external_ref: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          user_id: string;
          provider?: string;
          email: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expiry?: string | null;
          scope?: string | null;
          external_ref?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          user_id?: string;
          provider?: string;
          email?: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expiry?: string | null;
          scope?: string | null;
          external_ref?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_accounts_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      email_threads: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string | null;
          lead_id: string | null;
          client_id: string | null;
          account_id: string;
          gmail_thread_id: string;
          subject: string | null;
          last_message_at: string | null;
          last_read_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id?: string | null;
          lead_id?: string | null;
          client_id?: string | null;
          account_id: string;
          gmail_thread_id: string;
          subject?: string | null;
          last_message_at?: string | null;
          last_read_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string | null;
          lead_id?: string | null;
          client_id?: string | null;
          account_id?: string;
          gmail_thread_id?: string;
          subject?: string | null;
          last_message_at?: string | null;
          last_read_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_threads_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_threads_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_spaces: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string | null;
          lead_id: string | null;
          client_id: string | null;
          account_id: string;
          space_name: string;
          space_display_name: string | null;
          last_read_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id?: string | null;
          lead_id?: string | null;
          client_id?: string | null;
          account_id: string;
          space_name: string;
          space_display_name?: string | null;
          last_read_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string | null;
          lead_id?: string | null;
          client_id?: string | null;
          account_id?: string;
          space_name?: string;
          space_display_name?: string | null;
          last_read_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          company: string;
          converted_at: string | null;
          converted_client_id: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          owner_id: string | null;
          source: string | null;
          stage: Database["public"]["Enums"]["lead_stage"];
          studio_id: string;
          updated_at: string;
        };
        Insert: {
          company: string;
          converted_at?: string | null;
          converted_client_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          source?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          studio_id: string;
          updated_at?: string;
        };
        Update: {
          company?: string;
          converted_at?: string | null;
          converted_client_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          source?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          studio_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey";
            columns: ["converted_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["membership_role"];
          studio_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          studio_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          studio_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      project_summaries: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          content: string;
          model: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          content: string;
          model?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          content?: string;
          model?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          client_id: string | null;
          created_at: string;
          due_date: string | null;
          external_ref: Json | null;
          id: string;
          notes: string | null;
          owner_id: string | null;
          shoot_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          studio_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          due_date?: string | null;
          external_ref?: Json | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          shoot_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          studio_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          due_date?: string | null;
          external_ref?: Json | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          shoot_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          studio_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      review_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          review_link_id: string | null;
          reviewer_name: string | null;
          studio_id: string;
          version_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          review_link_id?: string | null;
          reviewer_name?: string | null;
          studio_id: string;
          version_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          review_link_id?: string | null;
          reviewer_name?: string | null;
          studio_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_comments_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_comments_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "versions";
            referencedColumns: ["id"];
          },
        ];
      };
      review_links: {
        Row: {
          asset_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          project_id: string;
          recipient: string | null;
          revoked: boolean;
          studio_id: string;
          token: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          project_id: string;
          recipient?: string | null;
          revoked?: boolean;
          studio_id: string;
          token: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          project_id?: string;
          recipient?: string | null;
          revoked?: boolean;
          studio_id?: string;
          token?: string;
        };
        Relationships: [];
      };
      slack_channels: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string | null;
          lead_id: string | null;
          client_id: string | null;
          account_id: string;
          slack_channel_id: string;
          channel_name: string | null;
          last_read_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id?: string | null;
          lead_id?: string | null;
          client_id?: string | null;
          account_id: string;
          slack_channel_id: string;
          channel_name?: string | null;
          last_read_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string | null;
          lead_id?: string | null;
          client_id?: string | null;
          account_id?: string;
          slack_channel_id?: string;
          channel_name?: string | null;
          last_read_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      studios: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      versions: {
        Row: {
          asset_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          mime_type: string | null;
          notes: string | null;
          size_bytes: number | null;
          storage_path: string | null;
          studio_id: string;
          url: string | null;
          version_number: number;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          studio_id: string;
          url?: string | null;
          version_number: number;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          studio_id?: string;
          url?: string | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "versions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "versions_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_studio_admin: { Args: { p_studio: string }; Returns: boolean };
      is_studio_member: { Args: { p_studio: string }; Returns: boolean };
    };
    Enums: {
      activity_type: "note" | "activity" | "status_change" | "upload" | "approval";
      approval_status: "pending" | "approved" | "changes_requested";
      approval_target: "asset" | "version";
      asset_status:
        | "draft"
        | "in_review"
        | "needs_changes"
        | "approved"
        | "delivered";
      asset_type: "image" | "video" | "storyboard" | "reference" | "cut" | "other";
      client_type: "brand" | "agency";
      lead_stage: "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
      membership_role: "owner" | "admin" | "member";
      project_status: "pre_pro" | "shoot" | "post" | "delivered";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database["public"];

export type Tables<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Row"];

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Insert"];

export type TablesUpdate<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Update"];

export type Enums<
  T extends keyof DefaultSchema["Enums"],
> = DefaultSchema["Enums"][T];

// --- Convenience aliases used across the app ---
export type MembershipRole = Enums<"membership_role">;
export type ClientType = Enums<"client_type">;
export type LeadStage = Enums<"lead_stage">;
export type ProjectStatus = Enums<"project_status">;
export type AssetType = Enums<"asset_type">;
export type AssetStatus = Enums<"asset_status">;
export type ApprovalTarget = Enums<"approval_target">;
export type ApprovalStatus = Enums<"approval_status">;
export type ActivityType = Enums<"activity_type">;

export type Studio = Tables<"studios">;
export type Membership = Tables<"memberships">;
export type Client = Tables<"clients">;
export type Lead = Tables<"leads">;
export type Contact = Tables<"contacts">;
export type Project = Tables<"projects">;
export type Brief = Tables<"briefs">;
export type BriefAttachment = Tables<"brief_attachments">;
export type Asset = Tables<"assets">;
export type Version = Tables<"versions">;
export type Approval = Tables<"approvals">;
export type Activity = Tables<"activity">;
export type ReviewComment = Tables<"review_comments">;
export type ReviewLink = Tables<"review_links">;
export type Board = Tables<"boards">;
export type BoardItem = Tables<"board_items">;
export type EmailAccount = Tables<"email_accounts">;
export type EmailThread = Tables<"email_threads">;
export type SlackChannel = Tables<"slack_channels">;
