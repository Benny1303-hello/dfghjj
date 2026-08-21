import "server-only";
import { createClient } from "@supabase/supabase-js";

export interface Database {
  public: {
    Tables: {
      chat_conversations: {
        Row: { id: string; channel: string; started_at: string };
        Insert: { id?: string; channel?: string; started_at?: string };
        Update: { id?: string; channel?: string; started_at?: string };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          from_role: "user" | "bot";
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          from_role: "user" | "bot";
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          from_role?: "user" | "bot";
          text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// Client dùng service_role key — bypass RLS, CHỈ được import từ code chạy trên server
// (route handlers, Server Components). Không bao giờ import file này từ component "use client".
let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong .env");
  }

  client = createClient<Database>(url, secretKey, {
    auth: { persistSession: false },
  });
  return client;
}
