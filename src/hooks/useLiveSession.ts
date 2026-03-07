"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveSession } from "@/lib/types";

export function useLiveSession() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  };

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    const load = async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("id,creator_id,channel_name,title,status,started_at,ended_at,likes_count,viewers_count")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted) {
        setSession((data as LiveSession | null) ?? null);
        setLoading(false);
      }
    };

    void load();

    const channel = supabase
      .channel("live-session-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_sessions" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { session, loading };
}
