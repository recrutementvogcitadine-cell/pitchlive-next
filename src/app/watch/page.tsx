"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionRail from "@/components/live/ActionRail";
import ChatOverlay from "@/components/live/ChatOverlay";
import GiftTray from "@/components/live/GiftTray";
import JoinTicker from "@/components/live/JoinTicker";
import LiveHeader from "@/components/live/LiveHeader";
import VideoStage from "@/components/live/VideoStage";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useLiveSession } from "@/hooks/useLiveSession";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { normalizeWhatsappNumber } from "@/lib/boutique-data";
import "@/styles/live.css";

type FloatingHeart = {
  id: string;
  left: number;
  size: number;
  hue: number;
};

type JoinTickerItem = {
  id: string;
  name: string;
};

type IAgoraRTCClient = import("agora-rtc-sdk-ng").IAgoraRTCClient;

function toStableAgoraUid(seed: string): number {
  // Keep UID deterministic per viewer and inside uint32 positive range.
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 1) || 1;
}

function enforcePlayerVideoStyle(containerId: string) {
  if (typeof window === "undefined") return;

  let raf = 0;
  let ticks = 0;
  let timeoutId: number | undefined;
  let pendingMetadataHandler: (() => void) | null = null;

  const apply = () => {
    const container = document.getElementById(containerId);
    const video = container?.querySelector("video") as HTMLVideoElement | null;
    if (!video) return;

    video.style.objectFit = "contain";
    video.style.objectPosition = "center center";
    video.style.transform = "scaleX(1)";

    if (!pendingMetadataHandler) {
      pendingMetadataHandler = () => {
        video.style.objectFit = "contain";
        video.style.objectPosition = "center center";
        video.style.transform = "scaleX(1)";
      };
      video.onloadedmetadata = pendingMetadataHandler;
    }
  };

  const loop = () => {
    apply();
    ticks += 1;
    if (ticks < 20) {
      raf = window.requestAnimationFrame(loop);
    }
  };

  apply();
  raf = window.requestAnimationFrame(loop);
  timeoutId = window.setTimeout(() => {
    if (raf) window.cancelAnimationFrame(raf);
  }, 1200);

  return () => {
    if (raf) window.cancelAnimationFrame(raf);
    if (timeoutId) window.clearTimeout(timeoutId);

    const container = document.getElementById(containerId);
    const video = container?.querySelector("video") as HTMLVideoElement | null;
    if (video && video.onloadedmetadata === pendingMetadataHandler) {
      video.onloadedmetadata = null;
    }
  };
}

export default function WatchPage() {
  const { session, loading } = useLiveSession();
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [giftsCount, setGiftsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [notifyToast, setNotifyToast] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState<string>("");
  const [sellerDisplayName, setSellerDisplayName] = useState("Vendeur principal");
  const [isFollowingSeller, setIsFollowingSeller] = useState(false);
  const [joinTickerItems, setJoinTickerItems] = useState<JoinTickerItem[]>([]);
  const [audioUnlockRequired, setAudioUnlockRequired] = useState(false);
  const resubscribeTimerRef = useRef<number | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const remoteAudioTracksRef = useRef<Map<string, import("agora-rtc-sdk-ng").IRemoteAudioTrack>>(new Map());

  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  };

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

  const viewerAgoraUid = useMemo(() => {
    return toStableAgoraUid(viewerIdentity.id);
  }, [viewerIdentity.id]);

  const playRemoteAudioTracks = () => {
    let played = 0;
    remoteAudioTracksRef.current.forEach((track) => {
      try {
        track.play();
        played += 1;
      } catch {
        // Browser autoplay policies can still block until user interacts.
      }
    });
    if (played > 0) {
      setAudioUnlockRequired(false);
      setNotifyToast("Son active");
      window.setTimeout(() => setNotifyToast(null), 1500);
    }
  };

  const closeLiveView = () => {
    window.location.href = "/mur";
  };

  const appendJoinTicker = (name: string, id: string) => {
    setJoinTickerItems((prev) => [{ id, name }, ...prev].slice(0, 8));
  };

  const getPresenceName = (userId: string) => {
    if (userId === viewerIdentity.id) return "Vous";
    return `visiteur_${userId.slice(0, 4)}`;
  };

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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    await supabase.from("gifts").insert({
      live_session_id: session.id,
      user_id: viewerIdentity.id,
      username: viewerIdentity.username,
      gift_type: giftType,
    });
  };

  const openSellerStore = () => {
    if (env.sellerStoreUrl) {
      window.open(env.sellerStoreUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (session?.creator_id) {
      window.location.href = `/boutique/${encodeURIComponent(session.creator_id)}`;
      return;
    }

    window.location.href = "/boutique";
  };

  const openSellerWhatsApp = () => {
    const candidate = sellerWhatsapp || env.sellerWhatsapp;
    if (!candidate) {
      setNotifyToast("WhatsApp vendeur non configure.");
      window.setTimeout(() => setNotifyToast(null), 2200);
      return;
    }

    const normalized = normalizeWhatsappNumber(candidate);
    if (!normalized) {
      setNotifyToast("WhatsApp vendeur invalide.");
      window.setTimeout(() => setNotifyToast(null), 2200);
      return;
    }

    const waUrl = `https://wa.me/${normalized}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const followCreator = async () => {
    if (!session) return;
    setFollowersCount((prev) => prev + 1);
    setIsFollowingSeller(true);
    const supabase = getSupabase();
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
    const supabase = getSupabase();

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
  }, [session]);

  useEffect(() => {
    if (!session?.creator_id) return;

    let mounted = true;
    const loadSellerProfile = async () => {
      try {
        const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent(session.creator_id)}`, { cache: "no-store" });
        const body = (await res.json()) as { profile?: { whatsappNumber?: string; storeName?: string } | null };
        if (!mounted) return;
        setSellerWhatsapp(body.profile?.whatsappNumber ?? "");
        setSellerDisplayName(body.profile?.storeName?.trim() || "Vendeur principal");
      } catch {
        if (!mounted) return;
        setSellerWhatsapp("");
        setSellerDisplayName("Vendeur principal");
      }
    };

    void loadSellerProfile();

    return () => {
      mounted = false;
    };
  }, [session?.creator_id]);

  useEffect(() => {
    if (!session) return;
    const presenceId = crypto.randomUUID();
    const supabase = getSupabase();

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
  }, [session, viewerIdentity.id]);

  useEffect(() => {
    if (!session?.id) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`live-presence-watch-${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_presence", filter: `live_session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as { user_id?: string; id?: string };
          if (!row.user_id) return;
          appendJoinTicker(getPresenceName(row.user_id), row.id ?? crypto.randomUUID());
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.id, viewerIdentity.id]);

  useEffect(() => {
    if (!session?.creator_id) return;
    const key = `pitchlive.following.${session.creator_id}`;
    const existing = window.localStorage.getItem(key);
    setIsFollowingSeller(existing === "1");
  }, [session?.creator_id]);

  useEffect(() => {
    if (!session?.creator_id) return;
    if (!isFollowingSeller) return;
    const key = `pitchlive.following.${session.creator_id}`;
    window.localStorage.setItem(key, "1");
  }, [isFollowingSeller, session?.creator_id]);

  useEffect(() => {
    if (!session || !env.agoraAppId) return;
    let rtc: IAgoraRTCClient | null = null;
    let mounted = true;

    const join = async () => {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      // H264 is more reliable across mixed Android/iPhone spectator devices.
      rtc = AgoraRTC.createClient({ mode: "live", codec: "h264" });
      setClient(rtc);
      const activeRtc = rtc;
      if (!activeRtc) return;

      const subscribeAndPlay = async (
        user: import("agora-rtc-sdk-ng").IAgoraRTCRemoteUser,
        mediaType: "audio" | "video"
      ) => {
        try {
          await activeRtc.subscribe(user, mediaType);
          if (mediaType === "video") {
            // Try high stream, but do not block playback if Agora refuses the switch.
            try {
              await activeRtc.setRemoteVideoStreamType(user.uid, 0);
            } catch {
              // Ignore and keep rendering the available stream.
            }
            user.videoTrack?.play("agora-player", { fit: "contain", mirror: false });
            enforcePlayerVideoStyle("agora-player");
          }
          if (mediaType === "audio") {
            if (!user.audioTrack) return;
            remoteAudioTracksRef.current.set(String(user.uid), user.audioTrack);
            try {
              user.audioTrack.play();
              setAudioUnlockRequired(false);
            } catch {
              setAudioUnlockRequired(true);
            }
          }
        } catch {
          // Keep watcher resilient: retry loop below handles temporary RTC gaps.
        }
      };

      const ensureRemotePlayback = async () => {
        for (const user of activeRtc.remoteUsers) {
          if (user.hasVideo) {
            await subscribeAndPlay(user, "video");
          }
          if (user.hasAudio) {
            await subscribeAndPlay(user, "audio");
          }
        }
      };

      // Register handlers before join to avoid missing early publications.
      activeRtc.on("user-published", async (user, mediaType) => {
        if (mediaType !== "video" && mediaType !== "audio") return;
        await subscribeAndPlay(user, mediaType);
      });

      activeRtc.on("user-unpublished", (user, mediaType) => {
        if (mediaType !== "video" && mediaType !== "audio") return;
        if (mediaType === "video") {
          user.videoTrack?.stop();
          const holder = document.getElementById("agora-player");
          if (holder) holder.innerHTML = "";
        }
        if (mediaType === "audio") {
          remoteAudioTracksRef.current.get(String(user.uid))?.stop();
          remoteAudioTracksRef.current.delete(String(user.uid));
        }
      });

      activeRtc.on("user-info-updated", async () => {
        await ensureRemotePlayback();
      });

      const tokenRes = await fetch("/api/agora/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: session.channel_name, role: "subscriber", uid: viewerAgoraUid }),
      });
      if (!tokenRes.ok) {
        throw new Error("Impossible de recuperer le token Agora pour ce spectateur.");
      }
      const tokenBody = (await tokenRes.json()) as { token?: string };
      await activeRtc.setClientRole("audience");
      await activeRtc.join(env.agoraAppId, session.channel_name, tokenBody.token ?? null, viewerAgoraUid);

      // Fallback: subscribe to already-connected publishers if event timing was missed.
      await ensureRemotePlayback();

      // Keep repairing subscriptions after host camera switches or transient network losses.
      resubscribeTimerRef.current = window.setInterval(() => {
        void ensureRemotePlayback();
      }, 2200);
    };

    void join().catch(() => {
      if (mounted) {
        setNotifyToast("Connexion video instable. Reconnexion en cours...");
        window.setTimeout(() => setNotifyToast(null), 2200);
      }
    });

    return () => {
      mounted = false;
      if (resubscribeTimerRef.current) {
        window.clearInterval(resubscribeTimerRef.current);
        resubscribeTimerRef.current = null;
      }
      remoteAudioTracksRef.current.forEach((track) => track.stop());
      remoteAudioTracksRef.current.clear();
      rtc?.removeAllListeners();
      void rtc?.leave();
      setClient(null);
    };
  }, [session?.id, session?.channel_name, viewerAgoraUid]);

  useEffect(() => {
    const supabase = getSupabase();
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
  }, []);

  if (loading) {
    return <main className="livePage emptyState">Chargement du live...</main>;
  }

  if (!session) {
    return (
      <main className="livePage emptyState">
        <div>
          <h2>Aucun live en cours</h2>
          <p>Le vendeur principal n'est pas encore en direct.</p>
          <Link href="/creator/studio">Lancer un live vendeur maintenant</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="livePage">
      <VideoStage floatingHearts={floatingHearts} onStageTap={onDoubleTap}>
        {notifyToast ? <div className="notifyToast">{notifyToast}</div> : null}
        {audioUnlockRequired ? (
          <button type="button" className="audioUnlockButton" onClick={playRemoteAudioTracks}>
            Activer le son
          </button>
        ) : null}
        <LiveHeader
          sellerName={sellerDisplayName}
          likes={likesCount}
          viewers={session.viewers_count}
          isFollowing={isFollowingSeller}
          onFollow={() => void followCreator()}
          onClose={closeLiveView}
        />
        <JoinTicker items={joinTickerItems} />
        <GiftTray onSendGift={(gift) => void sendGift(gift)} />
        <ActionRail
          likes={likesCount}
          gifts={giftsCount}
          followers={followersCount}
          onLike={() => void sendLike()}
          onGift={() => void sendGift("spark")}
          onFollow={() => void followCreator()}
          onStore={openSellerStore}
          onWhatsApp={openSellerWhatsApp}
        />
        <ChatOverlay liveSessionId={session.id} username={viewerIdentity.username} />
      </VideoStage>
    </main>
  );
}
