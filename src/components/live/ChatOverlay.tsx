"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveMessage } from "@/lib/types";

type Props = {
  liveSessionId: string;
  username: string;
};

export default function ChatOverlay({ liveSessionId, username }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,live_session_id,user_id,username,content,created_at")
        .eq("live_session_id", liveSessionId)
        .order("created_at", { ascending: false })
        .limit(25);
      setMessages((data as LiveMessage[] | null) ?? []);
    };

    void load();

    const channel = supabase
      .channel(`chat-${liveSessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `live_session_id=eq.${liveSessionId}` },
        (payload) => {
          const row = payload.new as LiveMessage;
          setMessages((prev) => [row, ...prev].slice(0, 40));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveSessionId, supabase]);

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setError(null);

    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        liveSessionId,
        userId: crypto.randomUUID(),
        username,
        content,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (body.error === "blocked_by_moderation") {
        setError("Message bloque par la moderation.");
      } else {
        setError("Envoi impossible.");
      }
      return;
    }

    setDraft("");
  };

  return (
    <div className="chatOverlay">
      <div className="chatFeed">
        {messages.map((message) => (
          <p key={message.id}>
            <strong>{message.username}</strong> {message.content}
          </p>
        ))}
      </div>
      <div className="chatComposer">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ecris un message..."
          maxLength={180}
        />
        <button type="button" onClick={() => void send()}>
          Envoyer
        </button>
      </div>
      {error ? <p style={{ margin: 0, fontSize: 12, color: "#fca5a5" }}>{error}</p> : null}
    </div>
  );
}
