// Hand-written placeholder matching the shape produced by:
//   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
// Regenerate this file for real once the project is linked to a hosted Supabase
// project (see supabase/migrations for the source of truth). Until then, this
// keeps src/lib/supabase/{client,server,admin}.ts type-safe. `Relationships`
// arrays are required by @supabase/postgrest-js's GenericTable/GenericView
// constraints even though we don't hand-author foreign-key metadata here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "owner" | "admin";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: AppRole;
          email: string | null;
          full_name: string | null;
          // Updated only by the touch_last_seen() function — owners have no
          // UPDATE grant on this table, since `role` lives here too.
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      partners: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          question_set_id: string | null;
          alert_threshold: number;
          // Derived status lives in src/lib/subscription.ts — deliberately not
          // stored, so it can't drift out of sync with these dates.
          subscription_start: string | null;
          subscription_end: string | null;
          // Both null or both set (DB constraint). Null = heatmap defaults to
          // the fixed 8-20 range (src/lib/dashboard/heatmap.ts). close_hour <
          // open_hour means the venue is open overnight (e.g. 18 -> 2).
          open_hour: number | null;
          close_hour: number | null;
          // How often this partner's prize draw runs. prize_description is
          // this partner's own prize text; null means they haven't set one,
          // so guest-facing copy falls back to content_settings'
          // defaultPrizeDescription (src/lib/prize-copy.ts resolves this).
          prize_frequency: "weekly" | "monthly";
          prize_description: string | null;
          // Where the monthly Qvik payment request for this partner's own
          // subscription fee gets sent — not guest- or partner-facing.
          bank_account_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["partners"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["partners"]["Row"]>;
        Relationships: [];
      };
      partner_members: {
        Row: {
          partner_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: Pick<Database["public"]["Tables"]["partner_members"]["Row"], "partner_id" | "user_id"> &
          Partial<Database["public"]["Tables"]["partner_members"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["partner_members"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "partner_members_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_messages: {
        Row: {
          id: string;
          partner_id: string;
          sender_user_id: string | null;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["partner_messages"]["Row"]> & {
          partner_id: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["partner_messages"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "partner_messages_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      question_sets: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["question_sets"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["question_sets"]["Row"]>;
        Relationships: [];
      };
      question_aspects: {
        Row: {
          id: string;
          question_set_id: string;
          key: string;
          label: string;
          icon: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["question_aspects"]["Row"]> & {
          question_set_id: string;
          key: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_aspects"]["Row"]>;
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          partner_id: string;
          created_at: string;
          email: string | null;
          prize_id: string | null;
          winner_id: string | null;
          prize_consent_at: string | null;
          // Nonce of the single-use token the submission was made with; a
          // unique index on it is what prevents replaying one token.
          request_nonce: string | null;
          // Whether the winner's coupon email actually went out. NULL for
          // non-winners; the Napló flags anything other than 'sent'.
          winner_email_status: "sent" | "failed" | "not-configured" | "no-email" | null;
        };
        Insert: Partial<Database["public"]["Tables"]["submissions"]["Row"]> & { partner_id: string };
        Update: Partial<Database["public"]["Tables"]["submissions"]["Row"]>;
        Relationships: [];
      };
      submission_scores: {
        Row: {
          id: string;
          submission_id: string;
          aspect_key: string;
          score: number;
          reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["submission_scores"]["Row"]> & {
          submission_id: string;
          aspect_key: string;
          score: number;
        };
        Update: Partial<Database["public"]["Tables"]["submission_scores"]["Row"]>;
        Relationships: [];
      };
      demo_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          business: string;
          message: string | null;
          status: "new" | "contacted" | "closed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["demo_requests"]["Row"]> & {
          name: string;
          email: string;
          business: string;
        };
        Update: Partial<Database["public"]["Tables"]["demo_requests"]["Row"]>;
        Relationships: [];
      };
      content_settings: {
        Row: {
          id: number;
          content: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["content_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["content_settings"]["Row"]>;
        Relationships: [];
      };
      prize_draws: {
        Row: {
          id: string;
          partner_id: string;
          draw_date: string;
          submission_id: string;
          winner_id: string;
          drawn_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prize_draws"]["Row"]> & {
          partner_id: string;
          draw_date: string;
          submission_id: string;
          winner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["prize_draws"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      submissions_owner_view: {
        Row: {
          id: string;
          partner_id: string;
          created_at: string;
        };
        Relationships: [];
      };
      // The four aggregate views added by ..._aggregate_stats_views.sql. They
      // exist so the dashboards never fetch raw rows and average them in JS —
      // see that migration's header for why that was a correctness bug, not
      // just a performance one.
      partner_aspect_stats: {
        Row: {
          partner_id: string;
          aspect_key: string;
          avg_score: number;
          score_count: number;
        };
        Relationships: [];
      };
      partner_heatmap_stats: {
        Row: {
          partner_id: string;
          aspect_key: string;
          day_index: number;
          hour_bucket: number;
          avg_score: number;
          score_count: number;
        };
        Relationships: [];
      };
      partner_summary_stats: {
        Row: {
          partner_id: string;
          review_count: number;
          prize_count: number;
          reviews_24h: number;
          reviews_7d: number;
          avg_score: number | null;
        };
        Relationships: [];
      };
      // Admin-only engagement per partner: when their owner last opened the
      // dashboard, and when a guest last submitted. Two signals because they
      // fail in opposite directions.
      partner_activity: {
        Row: {
          partner_id: string;
          last_owner_seen_at: string | null;
          last_review_at: string | null;
          owner_count: number;
        };
        Relationships: [];
      };
      submission_log_view: {
        Row: {
          id: string;
          partner_id: string;
          created_at: string;
          // NULL for owners, real values for admins — masked in the view itself.
          email: string | null;
          prize_id: string | null;
          winner_id: string | null;
          scores: Record<string, number>;
          reasons: Record<string, string>;
          winner_email_status: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_partner_member: {
        Args: { target_partner_id: string };
        Returns: boolean;
      };
      fydback_hour_bucket: {
        Args: { h: number };
        Returns: number;
      };
      // Parameterized version of fydback_hour_bucket, bucketing against a
      // partner's own open_hour/close_hour instead of the fixed range. Not
      // called directly from TS — partner_heatmap_stats_range uses it
      // internally — kept here for completeness.
      partner_hour_bucket: {
        Args: { h: number; open_hour: number; close_hour: number };
        Returns: number;
      };
      // Stamps the CALLER's own profiles.last_seen_at, throttled to once per
      // 15 minutes in SQL. security definer rather than a self-update policy,
      // because such a policy would also let an owner edit their own `role`.
      touch_last_seen: {
        Args: Record<string, never>;
        Returns: void;
      };
      // Date-windowed variants of the aggregate views, added by
      // ..._partner_stats_date_range.sql. since_days null = all time. They are
      // functions rather than filterable views because a view would need a date
      // dimension, and at day granularity that exceeds max_rows again.
      partner_summary_range: {
        Args: { target_partner_id: string; since_days: number | null };
        Returns: { review_count: number; prize_count: number; avg_score: number | null }[];
      };
      partner_aspect_stats_range: {
        Args: { target_partner_id: string; since_days: number | null };
        Returns: { aspect_key: string; avg_score: number; score_count: number }[];
      };
      // Week-over-week: last 7 days vs. the 7 days before, fixed regardless
      // of the period picker. Powers the up/down arrow next to each aspect
      // tile (src/lib/dashboard/wow.ts).
      partner_aspect_stats_wow: {
        Args: { target_partner_id: string };
        Returns: {
          aspect_key: string;
          current_avg: number | null;
          previous_avg: number | null;
          current_count: number;
          previous_count: number;
        }[];
      };
      partner_heatmap_stats_range: {
        Args: { target_partner_id: string; since_days: number | null };
        Returns: {
          aspect_key: string;
          day_index: number;
          hour_bucket: number;
          avg_score: number;
          score_count: number;
        }[];
      };
      // Per-partner, per-aspect time series at an adaptive granularity
      // (day/week/month, chosen server-side based on since_days). Powers the
      // Trend toggle next to the heatmap in VenueInsights.
      partner_aspect_trend_range: {
        Args: { target_partner_id: string; since_days: number | null };
        Returns: {
          bucket_date: string;
          granularity: "day" | "week" | "month";
          aspect_key: string;
          avg_score: number;
          score_count: number;
        }[];
      };
      // Admin-only, portfolio-wide daily submission counts. Powers the
      // heartbeat chart on the admin Áttekintés page.
      portfolio_daily_review_counts: {
        Args: { since_days: number | null };
        Returns: { bucket_date: string; review_count: number }[];
      };
      // The single write path for guest reviews. service_role only — anon
      // holds no INSERT on submissions any more, by design.
      submit_guest_review: {
        Args: {
          p_partner_id: string;
          p_request_nonce: string;
          p_email: string | null;
          p_prize_id: string | null;
          p_prize_consent_at: string | null;
          p_scores: { aspect_key: string; score: number; reason: string | null }[];
        };
        // prize_entered is the DATABASE's answer, not the request: an address
        // that already entered this venue's draw twice today gets the review
        // stored but the entry dropped.
        Returns: { submission_id: string; prize_entered: boolean }[];
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
