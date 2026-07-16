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
          background: string;
          kind: string;
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
          background?: string;
          kind?: string;
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
          background?: string;
          kind?: string;
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
          parent_id: string | null;
          sort: number;
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
          parent_id?: string | null;
          sort?: number;
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
          parent_id?: string | null;
          sort?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      board_connections: {
        Row: {
          id: string;
          studio_id: string;
          board_id: string;
          from_item_id: string;
          to_item_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          board_id: string;
          from_item_id: string;
          to_item_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          board_id?: string;
          from_item_id?: string;
          to_item_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      board_shares: {
        Row: {
          id: string;
          studio_id: string;
          board_id: string;
          token: string;
          revoked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          board_id: string;
          token: string;
          revoked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          board_id?: string;
          token?: string;
          revoked?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      shot_boards: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          title: string | null;
          subtitle: string | null;
          client: string | null;
          agency: string | null;
          production_co: string | null;
          director: string | null;
          dp: string | null;
          location: string | null;
          deliverables: string | null;
          job_no: string | null;
          rev_date: string | null;
          shoot_days: string | null;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          title?: string | null;
          subtitle?: string | null;
          client?: string | null;
          agency?: string | null;
          production_co?: string | null;
          director?: string | null;
          dp?: string | null;
          location?: string | null;
          deliverables?: string | null;
          job_no?: string | null;
          rev_date?: string | null;
          shoot_days?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          title?: string | null;
          subtitle?: string | null;
          client?: string | null;
          agency?: string | null;
          production_co?: string | null;
          director?: string | null;
          dp?: string | null;
          location?: string | null;
          deliverables?: string | null;
          job_no?: string | null;
          rev_date?: string | null;
          shoot_days?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      shot_board_flavors: {
        Row: {
          id: string;
          studio_id: string;
          board_id: string;
          position: number;
          name: string;
          hue: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          board_id: string;
          position?: number;
          name?: string;
          hue?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          board_id?: string;
          position?: number;
          name?: string;
          hue?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      shot_groups: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          position: number;
          title: string;
          subtitle: string | null;
          description: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          position?: number;
          title?: string;
          subtitle?: string | null;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          position?: number;
          title?: string;
          subtitle?: string | null;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      storyboard_frames: {
        Row: {
          id: string;
          studio_id: string;
          board_id: string;
          position: number;
          scene: string | null;
          description: string | null;
          sound: string | null;
          notes: string | null;
          storage_path: string | null;
          mime_type: string | null;
          image_name: string | null;
          asset_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          board_id: string;
          position?: number;
          scene?: string | null;
          description?: string | null;
          sound?: string | null;
          notes?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          image_name?: string | null;
          asset_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          board_id?: string;
          position?: number;
          scene?: string | null;
          description?: string | null;
          sound?: string | null;
          notes?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          image_name?: string | null;
          asset_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shot_cards: {
        Row: {
          id: string;
          studio_id: string;
          group_id: string;
          position: number;
          code: string | null;
          day: string | null;
          flavor_name: string | null;
          flavor_hue: string | null;
          storage_path: string | null;
          mime_type: string | null;
          image_name: string | null;
          description: string | null;
          vo: string | null;
          shot_size: string | null;
          shot_type: string | null;
          movement: string | null;
          asset_id: string | null;
          tags: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          group_id: string;
          position?: number;
          code?: string | null;
          day?: string | null;
          flavor_name?: string | null;
          flavor_hue?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          image_name?: string | null;
          description?: string | null;
          vo?: string | null;
          shot_size?: string | null;
          shot_type?: string | null;
          movement?: string | null;
          asset_id?: string | null;
          tags?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          group_id?: string;
          position?: number;
          code?: string | null;
          day?: string | null;
          flavor_name?: string | null;
          flavor_hue?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          image_name?: string | null;
          description?: string | null;
          vo?: string | null;
          shot_size?: string | null;
          shot_type?: string | null;
          movement?: string | null;
          asset_id?: string | null;
          tags?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shots: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          position: number;
          scene: string | null;
          description: string;
          setup: string | null;
          notes: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          position?: number;
          scene?: string | null;
          description?: string;
          setup?: string | null;
          notes?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          position?: number;
          scene?: string | null;
          description?: string;
          setup?: string | null;
          notes?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      gear_items: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          position: number;
          category: string;
          name: string;
          qty: number;
          confirmed: boolean;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          position?: number;
          category?: string;
          name?: string;
          qty?: number;
          confirmed?: boolean;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          position?: number;
          category?: string;
          name?: string;
          qty?: number;
          confirmed?: boolean;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      deliverables: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          position: number;
          name: string;
          spec: string | null;
          due_date: string | null;
          status: string;
          link: string | null;
          notes: string | null;
          rate: number | null;
          qty: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          position?: number;
          name?: string;
          spec?: string | null;
          due_date?: string | null;
          status?: string;
          link?: string | null;
          notes?: string | null;
          rate?: number | null;
          qty?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          position?: number;
          name?: string;
          spec?: string | null;
          due_date?: string | null;
          status?: string;
          link?: string | null;
          notes?: string | null;
          rate?: number | null;
          qty?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      billing_accounts: {
        Row: {
          id: string;
          studio_id: string;
          provider: string;
          connected_by: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expiry: string | null;
          fb_account_id: string | null;
          fb_business_id: string | null;
          fb_identity_email: string | null;
          scope: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          provider?: string;
          connected_by?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expiry?: string | null;
          fb_account_id?: string | null;
          fb_business_id?: string | null;
          fb_identity_email?: string | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          provider?: string;
          connected_by?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expiry?: string | null;
          fb_account_id?: string | null;
          fb_business_id?: string | null;
          fb_identity_email?: string | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_invoices: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          fb_invoice_id: string;
          fb_client_id: string | null;
          kind: string;
          recipient_name: string | null;
          recipient_email: string | null;
          number: string | null;
          status: string;
          amount: number | null;
          amount_paid: number;
          currency: string;
          hosted_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          fb_invoice_id: string;
          fb_client_id?: string | null;
          kind?: string;
          recipient_name?: string | null;
          recipient_email?: string | null;
          number?: string | null;
          status?: string;
          amount?: number | null;
          amount_paid?: number;
          currency?: string;
          hosted_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          fb_invoice_id?: string;
          fb_client_id?: string | null;
          kind?: string;
          recipient_name?: string | null;
          recipient_email?: string | null;
          number?: string | null;
          status?: string;
          amount?: number | null;
          amount_paid?: number;
          currency?: string;
          hosted_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_profiles: {
        Row: {
          id: string;
          studio_id: string;
          business_name: string | null;
          address: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          default_terms: string | null;
          default_notes: string | null;
          invoice_prefix: string;
          estimate_prefix: string;
          proposal_prefix: string;
          next_invoice_no: number;
          next_estimate_no: number;
          next_proposal_no: number;
          default_doc_template: string;
          default_doc_accent: string;
          default_doc_font: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          business_name?: string | null;
          address?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          default_terms?: string | null;
          default_notes?: string | null;
          invoice_prefix?: string;
          estimate_prefix?: string;
          proposal_prefix?: string;
          next_invoice_no?: number;
          next_estimate_no?: number;
          next_proposal_no?: number;
          default_doc_template?: string;
          default_doc_accent?: string;
          default_doc_font?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          business_name?: string | null;
          address?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          default_terms?: string | null;
          default_notes?: string | null;
          invoice_prefix?: string;
          estimate_prefix?: string;
          proposal_prefix?: string;
          next_invoice_no?: number;
          next_estimate_no?: number;
          next_proposal_no?: number;
          default_doc_template?: string;
          default_doc_accent?: string;
          default_doc_font?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_documents: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string | null;
          kind: string;
          number: string | null;
          status: string;
          issue_date: string;
          due_date: string | null;
          bill_to_name: string | null;
          bill_to_company: string | null;
          bill_to_email: string | null;
          bill_to_address: string | null;
          reference: string | null;
          currency: string;
          discount: number;
          notes: string | null;
          terms: string | null;
          template: string;
          accent_color: string | null;
          font: string;
          share_token: string | null;
          viewed_at: string | null;
          paid_at: string | null;
          sent_at: string | null;
          accepted_at: string | null;
          declined_at: string | null;
          signer_name: string | null;
          signer_email: string | null;
          signature_kind: string | null;
          signature_data: string | null;
          signed_ip: string | null;
          snapshot: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id?: string | null;
          kind?: string;
          number?: string | null;
          status?: string;
          issue_date?: string;
          due_date?: string | null;
          bill_to_name?: string | null;
          bill_to_company?: string | null;
          bill_to_email?: string | null;
          bill_to_address?: string | null;
          reference?: string | null;
          currency?: string;
          discount?: number;
          notes?: string | null;
          terms?: string | null;
          template?: string;
          accent_color?: string | null;
          font?: string;
          share_token?: string | null;
          viewed_at?: string | null;
          paid_at?: string | null;
          sent_at?: string | null;
          accepted_at?: string | null;
          declined_at?: string | null;
          signer_name?: string | null;
          signer_email?: string | null;
          signature_kind?: string | null;
          signature_data?: string | null;
          signed_ip?: string | null;
          snapshot?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string | null;
          kind?: string;
          number?: string | null;
          status?: string;
          issue_date?: string;
          due_date?: string | null;
          bill_to_name?: string | null;
          bill_to_company?: string | null;
          bill_to_email?: string | null;
          bill_to_address?: string | null;
          reference?: string | null;
          currency?: string;
          discount?: number;
          notes?: string | null;
          terms?: string | null;
          template?: string;
          accent_color?: string | null;
          font?: string;
          share_token?: string | null;
          viewed_at?: string | null;
          paid_at?: string | null;
          sent_at?: string | null;
          accepted_at?: string | null;
          declined_at?: string | null;
          signer_name?: string | null;
          signer_email?: string | null;
          signature_kind?: string | null;
          signature_data?: string | null;
          signed_ip?: string | null;
          snapshot?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_document_attachments: {
        Row: {
          id: string;
          document_id: string;
          studio_id: string;
          name: string;
          storage_path: string;
          content_type: string | null;
          size_bytes: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          studio_id: string;
          name: string;
          storage_path: string;
          content_type?: string | null;
          size_bytes?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          studio_id?: string;
          name?: string;
          storage_path?: string;
          content_type?: string | null;
          size_bytes?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      billing_document_lines: {
        Row: {
          id: string;
          document_id: string;
          studio_id: string;
          position: number;
          description: string;
          rate: number;
          qty: number;
          tax_rate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          studio_id: string;
          position?: number;
          description?: string;
          rate?: number;
          qty?: number;
          tax_rate?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          studio_id?: string;
          position?: number;
          description?: string;
          rate?: number;
          qty?: number;
          tax_rate?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_scripts: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          content: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          content?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          content?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_shots: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          position: number;
          title: string;
          beat: string | null;
          method: string;
          stage: string;
          status: string;
          duration_sec: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          position?: number;
          title?: string;
          beat?: string | null;
          method?: string;
          stage?: string;
          status?: string;
          duration_sec?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          position?: number;
          title?: string;
          beat?: string | null;
          method?: string;
          stage?: string;
          status?: string;
          duration_sec?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_prompts: {
        Row: {
          id: string;
          studio_id: string;
          shot_id: string;
          stage: string;
          version: number;
          text: string;
          target_model: string | null;
          params: Json | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          shot_id: string;
          stage?: string;
          version?: number;
          text?: string;
          target_model?: string | null;
          params?: Json | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          shot_id?: string;
          stage?: string;
          version?: number;
          text?: string;
          target_model?: string | null;
          params?: Json | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_generations: {
        Row: {
          id: string;
          studio_id: string;
          shot_id: string;
          prompt_id: string | null;
          prompt: string | null;
          stage: string;
          kind: string;
          status: string;
          role: string | null;
          file_path: string | null;
          external_url: string | null;
          thumb_url: string | null;
          platform: string | null;
          model: string | null;
          model_version: string | null;
          seed: string | null;
          aspect: string | null;
          resolution: string | null;
          fps: number | null;
          duration_sec: number | null;
          guidance: number | null;
          cost: number | null;
          params: Json | null;
          parent_start_id: string | null;
          parent_end_id: string | null;
          generated_by: string | null;
          generated_by_name: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          shot_id: string;
          prompt_id?: string | null;
          prompt?: string | null;
          stage?: string;
          kind?: string;
          status?: string;
          role?: string | null;
          file_path?: string | null;
          external_url?: string | null;
          thumb_url?: string | null;
          platform?: string | null;
          model?: string | null;
          model_version?: string | null;
          seed?: string | null;
          aspect?: string | null;
          resolution?: string | null;
          fps?: number | null;
          duration_sec?: number | null;
          guidance?: number | null;
          cost?: number | null;
          params?: Json | null;
          parent_start_id?: string | null;
          parent_end_id?: string | null;
          generated_by?: string | null;
          generated_by_name?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          shot_id?: string;
          prompt_id?: string | null;
          prompt?: string | null;
          stage?: string;
          kind?: string;
          status?: string;
          role?: string | null;
          file_path?: string | null;
          external_url?: string | null;
          thumb_url?: string | null;
          platform?: string | null;
          model?: string | null;
          model_version?: string | null;
          seed?: string | null;
          aspect?: string | null;
          resolution?: string | null;
          fps?: number | null;
          duration_sec?: number | null;
          guidance?: number | null;
          cost?: number | null;
          params?: Json | null;
          parent_start_id?: string | null;
          parent_end_id?: string | null;
          generated_by?: string | null;
          generated_by_name?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          studio_id: string | null;
          user_id: string | null;
          email: string | null;
          message: string;
          page: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id?: string | null;
          user_id?: string | null;
          email?: string | null;
          message: string;
          page?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string | null;
          user_id?: string | null;
          email?: string | null;
          message?: string;
          page?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string | null;
          type: string;
          title: string;
          body: string | null;
          href: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id?: string | null;
          type: string;
          title: string;
          body?: string | null;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string | null;
          type?: string;
          title?: string;
          body?: string | null;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      project_billing: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          status: string;
          amount: number | null;
          invoice_no: string | null;
          notes: string | null;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          status?: string;
          amount?: number | null;
          invoice_no?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          status?: string;
          amount?: number | null;
          invoice_no?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_lines: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          position: number;
          category: string;
          description: string;
          estimated: number;
          actual: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          position?: number;
          category?: string;
          description?: string;
          estimated?: number;
          actual?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          position?: number;
          category?: string;
          description?: string;
          estimated?: number;
          actual?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      call_sheets: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          shoot_date: string | null;
          call_time: string | null;
          location: string | null;
          notes: string | null;
          production_title: string | null;
          day_of: string | null;
          crew_call: string | null;
          shoot_call: string | null;
          lunch: string | null;
          wrap: string | null;
          weather: string | null;
          sunrise: string | null;
          sunset: string | null;
          parking: string | null;
          hospital: string | null;
          company_name: string | null;
          company_address: string | null;
          company_website: string | null;
          company_phone: string | null;
          producer: string | null;
          producer_phone: string | null;
          director: string | null;
          director_phone: string | null;
          pm: string | null;
          pm_phone: string | null;
          breakfast: string | null;
          title: string | null;
          status: string;
          position: number;
          layout: Json | null;
          accent: string | null;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          shoot_date?: string | null;
          call_time?: string | null;
          location?: string | null;
          notes?: string | null;
          production_title?: string | null;
          day_of?: string | null;
          crew_call?: string | null;
          shoot_call?: string | null;
          lunch?: string | null;
          wrap?: string | null;
          weather?: string | null;
          sunrise?: string | null;
          sunset?: string | null;
          parking?: string | null;
          hospital?: string | null;
          company_name?: string | null;
          company_address?: string | null;
          company_website?: string | null;
          company_phone?: string | null;
          producer?: string | null;
          producer_phone?: string | null;
          director?: string | null;
          director_phone?: string | null;
          pm?: string | null;
          pm_phone?: string | null;
          breakfast?: string | null;
          title?: string | null;
          status?: string;
          position?: number;
          layout?: Json | null;
          accent?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          shoot_date?: string | null;
          call_time?: string | null;
          location?: string | null;
          notes?: string | null;
          production_title?: string | null;
          day_of?: string | null;
          crew_call?: string | null;
          shoot_call?: string | null;
          lunch?: string | null;
          wrap?: string | null;
          weather?: string | null;
          sunrise?: string | null;
          sunset?: string | null;
          parking?: string | null;
          hospital?: string | null;
          company_name?: string | null;
          company_address?: string | null;
          company_website?: string | null;
          company_phone?: string | null;
          producer?: string | null;
          producer_phone?: string | null;
          director?: string | null;
          director_phone?: string | null;
          pm?: string | null;
          pm_phone?: string | null;
          breakfast?: string | null;
          title?: string | null;
          status?: string;
          position?: number;
          layout?: Json | null;
          accent?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      call_sheet_entries: {
        Row: {
          id: string;
          studio_id: string;
          call_sheet_id: string;
          position: number;
          name: string;
          role: string | null;
          call_time: string | null;
          contact: string | null;
          kind: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          call_sheet_id: string;
          position?: number;
          name?: string;
          role?: string | null;
          call_time?: string | null;
          contact?: string | null;
          kind?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          call_sheet_id?: string;
          position?: number;
          name?: string;
          role?: string | null;
          call_time?: string | null;
          contact?: string | null;
          kind?: string;
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
          account_status: Database["public"]["Enums"]["account_status"];
          created_at: string;
          external_ref: Json | null;
          id: string;
          name: string;
          notes: string | null;
          owner_id: string | null;
          source: string | null;
          studio_id: string;
          type: Database["public"]["Enums"]["client_type"];
          updated_at: string;
        };
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"];
          created_at?: string;
          external_ref?: Json | null;
          id?: string;
          name: string;
          notes?: string | null;
          owner_id?: string | null;
          source?: string | null;
          studio_id: string;
          type?: Database["public"]["Enums"]["client_type"];
          updated_at?: string;
        };
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"];
          created_at?: string;
          external_ref?: Json | null;
          id?: string;
          name?: string;
          notes?: string | null;
          owner_id?: string | null;
          source?: string | null;
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
      deals: {
        Row: {
          account_id: string;
          closed_at: string | null;
          created_at: string;
          expected_close_date: string | null;
          id: string;
          lost_reason: string | null;
          notes: string | null;
          owner_id: string | null;
          probability: number | null;
          sort: number;
          source: string | null;
          stage: Database["public"]["Enums"]["deal_stage"];
          studio_id: string;
          title: string;
          updated_at: string;
          value: number | null;
          won_project_id: string | null;
        };
        Insert: {
          account_id: string;
          closed_at?: string | null;
          created_at?: string;
          expected_close_date?: string | null;
          id?: string;
          lost_reason?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          probability?: number | null;
          sort?: number;
          source?: string | null;
          stage?: Database["public"]["Enums"]["deal_stage"];
          studio_id: string;
          title: string;
          updated_at?: string;
          value?: number | null;
          won_project_id?: string | null;
        };
        Update: {
          account_id?: string;
          closed_at?: string | null;
          created_at?: string;
          expected_close_date?: string | null;
          id?: string;
          lost_reason?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          probability?: number | null;
          sort?: number;
          source?: string | null;
          stage?: Database["public"]["Enums"]["deal_stage"];
          studio_id?: string;
          title?: string;
          updated_at?: string;
          value?: number | null;
          won_project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_studio_id_fkey";
            columns: ["studio_id"];
            isOneToOne: false;
            referencedRelation: "studios";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_activities: {
        Row: {
          account_id: string | null;
          author_id: string | null;
          body: string | null;
          created_at: string;
          deal_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["crm_activity_kind"];
          occurred_at: string;
          studio_id: string;
        };
        Insert: {
          account_id?: string | null;
          author_id?: string | null;
          body?: string | null;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["crm_activity_kind"];
          occurred_at?: string;
          studio_id: string;
        };
        Update: {
          account_id?: string | null;
          author_id?: string | null;
          body?: string | null;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["crm_activity_kind"];
          occurred_at?: string;
          studio_id?: string;
        };
        Relationships: [];
      };
      project_tasks: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          title: string;
          notes: string | null;
          due_date: string | null;
          done: boolean;
          done_at: string | null;
          assignee_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          title: string;
          notes?: string | null;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
          assignee_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          title?: string;
          notes?: string | null;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
          assignee_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_tasks: {
        Row: {
          account_id: string | null;
          assignee_id: string | null;
          created_at: string;
          created_by: string | null;
          deal_id: string | null;
          done: boolean;
          done_at: string | null;
          due_date: string | null;
          id: string;
          notes: string | null;
          studio_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deal_id?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          studio_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deal_id?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          studio_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_tasks_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_tasks_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          added_by: string | null;
          created_at: string;
          id: string;
          project_id: string;
          role: string;
          studio_id: string;
          user_id: string;
        };
        Insert: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          project_id: string;
          role?: string;
          studio_id: string;
          user_id: string;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          role?: string;
          studio_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          project_id: string;
          revoked: boolean;
          role: string;
          studio_id: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string | null;
          project_id: string;
          revoked?: boolean;
          role?: string;
          studio_id: string;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string | null;
          project_id?: string;
          revoked?: boolean;
          role?: string;
          studio_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      call_sheet_templates: {
        Row: {
          id: string;
          studio_id: string;
          name: string;
          layout: Json | null;
          accent: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          name: string;
          layout?: Json | null;
          accent?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          name?: string;
          layout?: Json | null;
          accent?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      call_sheet_recipients: {
        Row: {
          id: string;
          studio_id: string;
          call_sheet_id: string;
          name: string;
          email: string | null;
          token: string;
          viewed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          call_sheet_id: string;
          name: string;
          email?: string | null;
          token: string;
          viewed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          call_sheet_id?: string;
          name?: string;
          email?: string | null;
          token?: string;
          viewed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          client_id: string | null;
          project_id: string | null;
          company: string | null;
          type: string | null;
          rate: number | null;
          notes: string | null;
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
          project_id?: string | null;
          company?: string | null;
          type?: string | null;
          rate?: number | null;
          notes?: string | null;
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
          project_id?: string | null;
          company?: string | null;
          type?: string | null;
          rate?: number | null;
          notes?: string | null;
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
      studio_invites: {
        Row: {
          id: string;
          studio_id: string;
          email: string;
          role: Database["public"]["Enums"]["membership_role"];
          token: string;
          invited_by: string | null;
          created_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked: boolean;
        };
        Insert: {
          id?: string;
          studio_id: string;
          email: string;
          role?: Database["public"]["Enums"]["membership_role"];
          token: string;
          invited_by?: string | null;
          created_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked?: boolean;
        };
        Update: {
          id?: string;
          studio_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          token?: string;
          invited_by?: string | null;
          created_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked?: boolean;
        };
        Relationships: [];
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
          archived_at: string | null;
          project_type: string;
          color: string | null;
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
          archived_at?: string | null;
          project_type?: string;
          color?: string | null;
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
          archived_at?: string | null;
          project_type?: string;
          color?: string | null;
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
      project_events: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          title: string;
          date: string;
          end_date: string | null;
          kind: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          title: string;
          date: string;
          end_date?: string | null;
          kind?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          title?: string;
          date?: string;
          end_date?: string | null;
          kind?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      doc_reviews: {
        Row: {
          id: string;
          studio_id: string;
          project_id: string;
          target_type: string;
          target_id: string;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          project_id: string;
          target_type: string;
          target_id: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          project_id?: string;
          target_type?: string;
          target_id?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          version_id: string | null;
          target_type: string | null;
          target_id: string | null;
          pin_number: number | null;
          pos_x: number | null;
          pos_y: number | null;
          timecode: number | null;
          resolved_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          review_link_id?: string | null;
          reviewer_name?: string | null;
          studio_id: string;
          version_id?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          pin_number?: number | null;
          pos_x?: number | null;
          pos_y?: number | null;
          timecode?: number | null;
          resolved_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          review_link_id?: string | null;
          reviewer_name?: string | null;
          studio_id?: string;
          version_id?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          pin_number?: number | null;
          pos_x?: number | null;
          pos_y?: number | null;
          timecode?: number | null;
          resolved_at?: string | null;
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
          asset_id: string | null;
          target_type: string | null;
          target_id: string | null;
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
          asset_id?: string | null;
          target_type?: string | null;
          target_id?: string | null;
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
          asset_id?: string | null;
          target_type?: string | null;
          target_id?: string | null;
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
          logo_path: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          logo_path?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          logo_path?: string | null;
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
      claim_pending_invites: { Args: Record<string, never>; Returns: number };
      studio_invite_preview: {
        Args: { p_token: string };
        Returns: {
          studio_name: string;
          invite_role: Database["public"]["Enums"]["membership_role"];
          invite_email: string;
          valid: boolean;
        }[];
      };
      claim_pending_project_invites: {
        Args: Record<string, never>;
        Returns: number;
      };
      review_target_project: {
        Args: { p_type: string; p_id: string };
        Returns: string;
      };
      review_comment_project: {
        Args: { p_version_id: string; p_type: string; p_id: string };
        Returns: string;
      };
      can_access_project: { Args: { p_project_id: string }; Returns: boolean };
      project_invite_preview: {
        Args: { p_token: string };
        Returns: {
          valid: boolean;
          invite_email: string;
          invite_role: string;
          studio_name: string;
          project_id: string;
          project_title: string;
        }[];
      };
    };
    Enums: {
      activity_type: "note" | "activity" | "status_change" | "upload" | "approval";
      approval_status: "pending" | "approved" | "changes_requested";
      approval_target:
        | "asset"
        | "version"
        | "shot_list"
        | "storyboard"
        | "moodboard"
        | "ai_shot";
      asset_status:
        | "draft"
        | "in_review"
        | "needs_changes"
        | "approved"
        | "delivered";
      asset_type: "image" | "video" | "storyboard" | "reference" | "cut" | "other";
      account_status: "prospect" | "active" | "past";
      client_type: "brand" | "agency";
      crm_activity_kind:
        | "note"
        | "call"
        | "meeting"
        | "email"
        | "stage_change"
        | "created"
        | "won"
        | "lost";
      deal_stage: "inbound" | "qualifying" | "bidding" | "awarded" | "lost";
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
export type AccountStatus = Enums<"account_status">;
export type DealStage = Enums<"deal_stage">;
export type CrmActivityKind = Enums<"crm_activity_kind">;
export type LeadStage = Enums<"lead_stage">;
export type ProjectStatus = Enums<"project_status">;
export type AssetType = Enums<"asset_type">;
export type AssetStatus = Enums<"asset_status">;
export type ApprovalTarget = Enums<"approval_target">;
export type ApprovalStatus = Enums<"approval_status">;
export type ActivityType = Enums<"activity_type">;

export type Studio = Tables<"studios">;
export type StudioInvite = Tables<"studio_invites">;
export type Membership = Tables<"memberships">;
export type Client = Tables<"clients">;
export type Deal = Tables<"deals">;
export type CrmActivity = Tables<"crm_activities">;
export type CrmTask = Tables<"crm_tasks">;
export type ProjectTask = Tables<"project_tasks">;
export type Lead = Tables<"leads">;
export type Contact = Tables<"contacts">;
export type Project = Tables<"projects">;
export type ProjectMember = Tables<"project_members">;
export type ProjectInvite = Tables<"project_invites">;
export type Brief = Tables<"briefs">;
export type BriefAttachment = Tables<"brief_attachments">;
export type Asset = Tables<"assets">;
export type Version = Tables<"versions">;
export type Approval = Tables<"approvals">;
export type Activity = Tables<"activity">;
export type ReviewComment = Tables<"review_comments">;
export type ReviewLink = Tables<"review_links">;
export type DocReview = Tables<"doc_reviews">;
export type ProjectEvent = Tables<"project_events">;
export type CallSheetRecipient = Tables<"call_sheet_recipients">;
export type CallSheetTemplate = Tables<"call_sheet_templates">;
export type Board = Tables<"boards">;
export type BoardItem = Tables<"board_items">;
export type Shot = Tables<"shots">;
export type ShotBoard = Tables<"shot_boards">;
export type ShotBoardFlavor = Tables<"shot_board_flavors">;
export type ShotGroup = Tables<"shot_groups">;
export type ShotCard = Tables<"shot_cards">;
export type StoryboardFrame = Tables<"storyboard_frames">;
export type CallSheet = Tables<"call_sheets">;
export type CallSheetEntry = Tables<"call_sheet_entries">;
export type BudgetLine = Tables<"budget_lines">;
export type GearItem = Tables<"gear_items">;
export type Deliverable = Tables<"deliverables">;
export type ProjectBilling = Tables<"project_billing">;
export type BillingAccount = Tables<"billing_accounts">;
export type ProjectInvoice = Tables<"project_invoices">;
export type BillingProfile = Tables<"billing_profiles">;
export type BillingDocument = Tables<"billing_documents">;
export type BillingDocumentLine = Tables<"billing_document_lines">;
export type BillingDocumentAttachment = Tables<"billing_document_attachments">;
export type AiScript = Tables<"ai_scripts">;
export type AiShot = Tables<"ai_shots">;
export type AiPrompt = Tables<"ai_prompts">;
export type AiGeneration = Tables<"ai_generations">;
export type Notification = Tables<"notifications">;
export type EmailAccount = Tables<"email_accounts">;
export type EmailThread = Tables<"email_threads">;
export type SlackChannel = Tables<"slack_channels">;
