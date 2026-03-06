"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActionRail from "@/components/live/ActionRail";
import ChatOverlay from "@/components/live/ChatOverlay";
import GiftTray from "@/components/live/GiftTray";
import LiveHeader from "@/components/live/LiveHeader";
import VideoStage from "@/components/live/VideoStage";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useLiveSession } from "@/hooks/useLiveSession";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import "@/styles/live.css";

type FloatingHeart = {
  id: string;
  left: number;
  size: number;
  hue: number;
};

type IAgoraRTCClient = import("agora-rtc-sdk-ng").IAgoraRTCClient;

export default function WatchPage() {
  const { session, loading } = useLiveSession();
  const supabase = useMemo(() => createClient(), []);
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [giftsCount, setGiftsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [notifyToast, setNotifyToast] = useState<string | null>(null);

  const viewerIdentity = useMemo(() => {
    if (typeof window === "undefined") return { id: "guest", username: "guest" };
    const key = "pitchlive.viewer";
    const existing = window.localStorage.getItem(key);
    if (existing) return JSON.parse(existing) as { id: string; username: string };
    const generated = {
      id: crypto.randomUUID(),
      username: `viewer_${Math.random().toString(36).slice(2, 7)}`,
    };
    window.localStorage.setItem(key, JSON.stringify(generated));
    return generated;
  }, []);

  const addHeart = () => {
    const heart: FloatingHeart = {
      id: `${Date.now()}-${Math.random()}`,
      left: 60 + Math.random() * 28,
      size: 18 + Math.random() * 20,
      hue: 340 + Math.random() * 20,
    };
    setFloatingHearts((prev) => [...prev, heart]);
    window.setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((item) => item.id !== heart.id));
    }, 1000);
  };

  const sendLike = async () => {
    if (!session) return;
    addHeart();
    setLikesCount((prev) => prev + 1);
    await supabase.from("likes").insert({
      live_session_id: session.id,
      user_id: viewerIdentity.id,
    });
  };

  const onDoubleTap = useDoubleTap(() => {
    void sendLike();
  });

  const sendGift = async (giftType: string) => {
    if (!session) return;
    setGiftsCount((prev) => prev + 1);
    await supabase.from("gifts").insert({
      live_session_id: session.id,
      user_id: viewerIdentity.id,
      username: viewerIdentity.username,
      gift_type: giftType,
    });
  };

  const followCreator = async () => {
    if (!session) return;
    setFollowersCount((prev) => prev + 1);
    await supabase.from("followers").upsert(
      {
        creator_id: session.creator_id,
        follower_id: viewerIdentity.id,
      },
      { onConflict: "creator_id,follower_id" }
    );
  };

  useEffect(() => {
    if (!session) return;
    let mounted = true;

    const loadStats = async () => {
      const [likes, gifts, followers] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("live_session_id", session.id),
        supabase.from("gifts").select("id", { count: "exact", head: true }).eq("live_session_id", session.id),
        supabase.from("followers").select("creator_id", { count: "exact", head: true }).eq("creator_id", session.creator_id),
      ]);

      if (!mounted) return;
      setLikesCount(likes.count ?? 0);
      setGiftsCount(gifts.count ?? 0);
      setFollowersCount(followers.count ?? 0);
    };

    void loadStats();

    const channel = supabase
      .channel(`live-stats-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes", filter: `live_session_id=eq.${session.id}` }, () => {
        setLikesCount((prev) => prev + 1);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts", filter: `live_session_id=eq.${session.id}` }, () => {
        setGiftsCount((prev) => prev + 1);
      })
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [session, supabase]);

  useEffect(() => {
    if (!session) return;
    const presenceId = crypto.randomUUID();

    const join = async () => {
      await supabase.from("live_presence").insert({
        id: presenceId,
        live_session_id: session.id,
        user_id: viewerIdentity.id,
      });
    };

    void join();

    return () => {
      void supabase.from("live_presence").delete().eq("id", presenceId);
    };
  }, [session, supabase, viewerIdentity.id]);

  useEffect(() => {
    if (!session || !env.agoraAppId) return;
    let rtc: IAgoraRTCClient | null = null;

    const join = async () => {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      rtc = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      setClient(rtc);
      const activeRtc = rtc;
      if (!activeRtc) return;

      const tokenRes = await fetch("/api/agora/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: session.channel_name, role: "subscriber", uid: 0 }),
      });
      const tokenBody = (await tokenRes.json()) as { token?: string };
      await activeRtc.setClientRole("audience");
      await activeRtc.join(env.agoraAppId, session.channel_name, tokenBody.token ?? null, null);

      activeRtc.on("user-published", async (user, mediaType) => {
        await activeRtc.subscribe(user, mediaType);
        if (mediaType === "video") {
          user.videoTrack?.play("agora-player");
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });
    };

    void join();

    return () => {
      void rtc?.leave();
      setClient(null);
    };
  }, [session]);

  useEffect(() => {
    const channel = supabase
      .channel("live-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_sessions" }, (payload) => {
        const row = payload.new as { title?: string; status?: string };
        if (row.status === "live") {
          setNotifyToast(`Nouveau live: ${row.title ?? "Live en direct"}`);
          window.setTimeout(() => setNotifyToast(null), 2600);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return <main className="livePage emptyState">Chargement du live...</main>;
  }

  if (!session) {
    return (
      <main className="livePage emptyState">
        <div>
          <h2>Aucun live en cours</h2>
          <p>Le creat eur principal n'est pas encore en direct.</p>
          <Link href="/creator/studio">Lancer un live maintenant</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="livePage">
      <VideoStage floatingHearts={floatingHearts} onStageTap={onDoubleTap}>
        {notifyToast ? <div className="notifyToast">{notifyToast}</div> : null}
        <LiveHeader title={session.title} viewers={session.viewers_count} likes={likesCount} />
        <GiftTray onSendGift={(gift) => void sendGift(gift)} />
        <ActionRail likes={likesCount} gifts={giftsCount} followers={followersCount} onLike={() => void sendLike()} onGift={() => void sendGift("spark")} onFollow={() => void followCreator()} />
        <ChatOverlay liveSessionId={session.id} username={viewerIdentity.username} />
      </VideoStage>
    </main>
  );
}
