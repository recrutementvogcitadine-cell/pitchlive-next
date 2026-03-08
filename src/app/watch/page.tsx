"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionRail from "@/components/live/ActionRail";
import ChatOverlay from "@/components/live/ChatOverlay";
import JoinTicker from "@/components/live/JoinTicker";
import LiveHeader from "@/components/live/LiveHeader";
import VideoStage from "@/components/live/VideoStage";
import { useLiveSessions } from "@/hooks/useLiveSessions";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { normalizeWhatsappNumber } from "@/lib/boutique-data";
import type { LiveSession } from "@/lib/types";
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

type FloatingRose = {
  id: string;
  left: number;
  size: number;
  drift: number;
};

type IAgoraRTCClient = import("agora-rtc-sdk-ng").IAgoraRTCClient;

type ViewerProfile = {
  id: string;
  username: string;
  status?: string;
  role?: string;
};

function toStableAgoraUid(seed: string): number {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export default function WatchPage() {
  const { sessions, loading } = useLiveSessions();
  const [activeIndex, setActiveIndex] = useState(0);
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
  const [floatingRoses, setFloatingRoses] = useState<FloatingRose[]>([]);
  const [giftSenderTag, setGiftSenderTag] = useState<string | null>(null);
  const [milestoneBellVisible, setMilestoneBellVisible] = useState(false);
  const [milestoneLikes, setMilestoneLikes] = useState(0);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const scrollTickRef = useRef<number | null>(null);
  const resubscribeTimerRef = useRef<number | null>(null);
  const stageTapTsRef = useRef(0);
  const milestoneLevelRef = useRef(0);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const remoteAudioTracksRef = useRef<Map<string, import("agora-rtc-sdk-ng").IRemoteAudioTrack>>(new Map());
  const tokenCacheRef = useRef<Map<string, string>>(new Map());
  const profilePrefetchRef = useRef<Set<string>>(new Set());

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

  const canOrderOnWhatsapp = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem("pitchlive.viewer");
      if (!raw) return false;
      const viewer = JSON.parse(raw) as ViewerProfile;
      return viewer.status === "validated";
    } catch {
      return false;
    }
  }, [viewerIdentity.id]);

  const activeSession: LiveSession | null = sessions[activeIndex] ?? null;
  const activePlayerId = activeSession ? `agora-player-${activeSession.id}` : "agora-player";

  const viewerAgoraUid = useMemo(() => {
    const sessionSuffix = activeSession?.id ?? "none";
    return toStableAgoraUid(`${viewerIdentity.id}:${sessionSuffix}`);
  }, [viewerIdentity.id, activeSession?.id]);

  useEffect(() => {
    if (!sessions.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((prev) => clamp(prev, 0, sessions.length - 1));
  }, [sessions.length]);

  useEffect(() => {
    // Warm dynamic SDK chunk ahead of first swipe.
    void import("agora-rtc-sdk-ng");
  }, []);

  useEffect(() => {
    if (!sessions.length) return;

    const prefetchTargets = [activeIndex - 1, activeIndex + 1, activeIndex + 2]
      .filter((idx) => idx >= 0 && idx < sessions.length)
      .map((idx) => sessions[idx]);

    const run = async () => {
      await Promise.all(
        prefetchTargets.map(async (session) => {
          const uid = toStableAgoraUid(`${viewerIdentity.id}:${session.id}`);
          const tokenKey = `${session.id}:${uid}`;

          if (!tokenCacheRef.current.has(tokenKey)) {
            try {
              const tokenRes = await fetch("/api/agora/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channel: session.channel_name, role: "subscriber", uid }),
              });
              if (tokenRes.ok) {
                const tokenBody = (await tokenRes.json()) as { token?: string };
                if (tokenBody.token) {
                  tokenCacheRef.current.set(tokenKey, tokenBody.token);
                }
              }
            } catch {
              // Best-effort prefetch only.
            }
          }

          if (!profilePrefetchRef.current.has(session.creator_id)) {
            profilePrefetchRef.current.add(session.creator_id);
            void fetch(`/api/seller/profile?sellerId=${encodeURIComponent(session.creator_id)}`, { cache: "no-store" }).catch(() => undefined);
          }
        })
      );
    };

    void run();
  }, [activeIndex, sessions, viewerIdentity.id]);

  const onFeedScroll = () => {
    if (!feedRef.current || !sessions.length) return;
    if (scrollTickRef.current) {
      window.cancelAnimationFrame(scrollTickRef.current);
    }

    scrollTickRef.current = window.requestAnimationFrame(() => {
      const feed = feedRef.current;
      if (!feed) return;
      const idx = Math.round(feed.scrollTop / Math.max(feed.clientHeight, 1));
      setActiveIndex(clamp(idx, 0, sessions.length - 1));
    });
  };

  const scrollToIndex = (index: number) => {
    const feed = feedRef.current;
    if (!feed) return;
    const next = clamp(index, 0, Math.max(sessions.length - 1, 0));
    feed.scrollTo({ top: next * feed.clientHeight, behavior: "smooth" });
  };

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

  const addRoseBurst = (sender: string) => {
    const roses: FloatingRose[] = Array.from({ length: 9 }).map((_, idx) => ({
      id: `${Date.now()}-${Math.random()}-${idx}`,
      left: 44 + Math.random() * 28,
      size: 18 + Math.random() * 18,
      drift: -20 + Math.random() * 40,
    }));
    setFloatingRoses((prev) => [...prev, ...roses]);
    setGiftSenderTag(`${sender} envoie des roses`);
    window.setTimeout(() => setGiftSenderTag(null), 1800);
    window.setTimeout(() => {
      const roseIds = new Set(roses.map((rose) => rose.id));
      setFloatingRoses((prev) => prev.filter((item) => !roseIds.has(item.id)));
    }, 1500);
  };

  const triggerMilestoneFeedback = (threshold: number) => {
    setMilestoneLikes(threshold);
    setMilestoneBellVisible(true);
    window.setTimeout(() => setMilestoneBellVisible(false), 2000);

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([120, 70, 150]);
    }
  };

  const pushFollowerMilestoneNotification = async (threshold: number) => {
    if (!activeSession?.creator_id) return;

    await fetch("/api/push/notify-followers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: activeSession.creator_id,
        sessionId: activeSession.id,
        sellerName: sellerDisplayName,
        threshold,
      }),
    });
  };

  const ensurePushSubscription = async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;
    if (!env.webPushPublicKey) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.webPushPublicKey),
      }));

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: viewerIdentity.id,
        subscription,
      }),
    });
  };

  const tapStageToLike = () => {
    const now = Date.now();
    if (now - stageTapTsRef.current < 120) return;
    stageTapTsRef.current = now;
    void sendLike();
  };

  const sendLike = async () => {
    if (!activeSession) return;
    addHeart();
    setLikesCount((prev) => prev + 1);
    const supabase = getSupabase();
    await supabase.from("likes").insert({
      live_session_id: activeSession.id,
      user_id: viewerIdentity.id,
    });
  };

  const sendGift = async (giftType: string) => {
    if (!activeSession) return;
    setGiftsCount((prev) => prev + 1);
    addRoseBurst(viewerIdentity.username);
    const supabase = getSupabase();
    await supabase.from("gifts").insert({
      live_session_id: activeSession.id,
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

    if (activeSession?.creator_id) {
      window.location.href = `/boutique/${encodeURIComponent(activeSession.creator_id)}`;
      return;
    }

    window.location.href = "/boutique";
  };

  const openSellerWhatsApp = () => {
    if (!canOrderOnWhatsapp) {
      setNotifyToast("Commande WhatsApp reservee aux visiteurs certifies.");
      window.setTimeout(() => setNotifyToast(null), 2200);
      return;
    }

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
    if (!activeSession) return;
    setFollowersCount((prev) => prev + 1);
    setIsFollowingSeller(true);
    const supabase = getSupabase();
    await supabase.from("followers").upsert(
      {
        creator_id: activeSession.creator_id,
        follower_id: viewerIdentity.id,
      },
      { onConflict: "creator_id,follower_id" }
    );

    await ensurePushSubscription().catch(() => undefined);
  };

  useEffect(() => {
    if (!activeSession) return;
    let mounted = true;
    const supabase = getSupabase();

    const loadStats = async () => {
      const [likes, gifts, followers] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("live_session_id", activeSession.id),
        supabase.from("gifts").select("id", { count: "exact", head: true }).eq("live_session_id", activeSession.id),
        supabase.from("followers").select("creator_id", { count: "exact", head: true }).eq("creator_id", activeSession.creator_id),
      ]);

      if (!mounted) return;
      setLikesCount(likes.count ?? 0);
      milestoneLevelRef.current = Math.floor((likes.count ?? 0) / 200);
      setGiftsCount(gifts.count ?? 0);
      setFollowersCount(followers.count ?? 0);
    };

    void loadStats();

    const channel = supabase
      .channel(`live-stats-${activeSession.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes", filter: `live_session_id=eq.${activeSession.id}` }, (payload) => {
        const row = payload.new as { user_id?: string };
        if (row.user_id && row.user_id === viewerIdentity.id) return;
        setLikesCount((prev) => prev + 1);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts", filter: `live_session_id=eq.${activeSession.id}` }, (payload) => {
        const row = payload.new as { user_id?: string };
        if (row.user_id && row.user_id === viewerIdentity.id) return;
        setGiftsCount((prev) => prev + 1);
      })
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [activeSession?.id, activeSession?.creator_id, viewerIdentity.id]);

  useEffect(() => {
    if (!activeSession?.id || !activeSession?.creator_id) return;
    const nextLevel = Math.floor(likesCount / 200);
    if (nextLevel <= 0 || nextLevel <= milestoneLevelRef.current) return;

    const threshold = nextLevel * 200;
    milestoneLevelRef.current = nextLevel;
    triggerMilestoneFeedback(threshold);

    setNotifyToast(`Palier ${threshold} coeurs atteint`);
    window.setTimeout(() => setNotifyToast(null), 2200);

    void pushFollowerMilestoneNotification(threshold).catch(() => undefined);
  }, [likesCount, activeSession?.id, activeSession?.creator_id]);

  useEffect(() => {
    if (!activeSession?.creator_id) return;

    let mounted = true;
    const loadSellerProfile = async () => {
      try {
        const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent(activeSession.creator_id)}`, { cache: "no-store" });
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
  }, [activeSession?.creator_id]);

  useEffect(() => {
    if (!activeSession) return;
    const presenceId = crypto.randomUUID();
    const supabase = getSupabase();

    const join = async () => {
      await supabase.from("live_presence").insert({
        id: presenceId,
        live_session_id: activeSession.id,
        user_id: viewerIdentity.id,
      });
    };

    void join();

    return () => {
      void supabase.from("live_presence").delete().eq("id", presenceId);
    };
  }, [activeSession?.id, viewerIdentity.id]);

  useEffect(() => {
    if (!activeSession?.id) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`live-presence-watch-${activeSession.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_presence", filter: `live_session_id=eq.${activeSession.id}` },
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
  }, [activeSession?.id, viewerIdentity.id]);

  useEffect(() => {
    if (!activeSession?.creator_id) return;
    const key = `pitchlive.following.${activeSession.creator_id}`;
    const existing = window.localStorage.getItem(key);
    setIsFollowingSeller(existing === "1");
  }, [activeSession?.creator_id]);

  useEffect(() => {
    if (!activeSession?.creator_id || !isFollowingSeller) return;
    const key = `pitchlive.following.${activeSession.creator_id}`;
    window.localStorage.setItem(key, "1");
  }, [isFollowingSeller, activeSession?.creator_id]);

  useEffect(() => {
    if (!activeSession?.creator_id || !isFollowingSeller) return;
    void ensurePushSubscription().catch(() => undefined);
  }, [activeSession?.creator_id, isFollowingSeller]);

  useEffect(() => {
    if (!activeSession || !env.agoraAppId) return;

    let rtc: IAgoraRTCClient | null = null;
    let mounted = true;

    const join = async () => {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
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
            try {
              await activeRtc.setRemoteVideoStreamType(user.uid, 0);
            } catch {
              // Keep rendering available stream type.
            }
            user.videoTrack?.play(activePlayerId, { fit: "contain", mirror: false });
            enforcePlayerVideoStyle(activePlayerId);
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
          // Retry loop below handles transient issues.
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

      activeRtc.on("user-published", async (user, mediaType) => {
        if (mediaType !== "video" && mediaType !== "audio") return;
        await subscribeAndPlay(user, mediaType);
      });

      activeRtc.on("user-unpublished", (user, mediaType) => {
        if (mediaType !== "video" && mediaType !== "audio") return;
        if (mediaType === "video") {
          user.videoTrack?.stop();
          const holder = document.getElementById(activePlayerId);
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

      const tokenKey = `${activeSession.id}:${viewerAgoraUid}`;
      let token: string | null = tokenCacheRef.current.get(tokenKey) ?? null;
      if (!token) {
        const tokenRes = await fetch("/api/agora/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: activeSession.channel_name, role: "subscriber", uid: viewerAgoraUid }),
        });
        if (!tokenRes.ok) {
          throw new Error("Impossible de recuperer le token Agora pour ce spectateur.");
        }
        const tokenBody = (await tokenRes.json()) as { token?: string };
        token = tokenBody.token ?? null;
        if (token) {
          tokenCacheRef.current.set(tokenKey, token);
        }
      }
      await activeRtc.setClientRole("audience");
      await activeRtc.join(env.agoraAppId, activeSession.channel_name, token ?? null, viewerAgoraUid);

      await ensureRemotePlayback();

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
  }, [activeSession?.id, activeSession?.channel_name, activePlayerId, viewerAgoraUid]);

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

  if (!sessions.length) {
    return (
      <main className="livePage emptyState">
        <div>
          <h2>Aucun live en cours</h2>
          <p>Le vendeur principal n'est pas encore en direct.</p>
          <Link href="/vendeur/inscription">S'inscrire comme vendeur pour lancer un live</Link>
        </div>
      </main>
    );
  }

  return (
    <main ref={feedRef} className="liveFeedScroll" onScroll={onFeedScroll}>
      {sessions.map((session, index) => {
        const isActive = index === activeIndex;
        return (
          <div key={session.id} className="liveFeedItem" onClick={() => !isActive && scrollToIndex(index)}>
            <VideoStage
              playerId={`agora-player-${session.id}`}
              floatingHearts={isActive ? floatingHearts : []}
              onStageTap={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest("button,a,input,textarea,label")) return;
                if (isActive) {
                  tapStageToLike();
                } else {
                  scrollToIndex(index);
                }
              }}
            >
              {isActive ? (
                <>
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
                    milestoneBellVisible={milestoneBellVisible}
                    milestoneLikes={milestoneLikes}
                    onFollow={() => void followCreator()}
                    onClose={closeLiveView}
                  />
                  <JoinTicker items={joinTickerItems} />
                  <ActionRail
                    gifts={giftsCount}
                    followers={followersCount}
                    onGift={() => void sendGift("rose")}
                    onFollow={() => void followCreator()}
                    onStore={openSellerStore}
                    onWhatsApp={openSellerWhatsApp}
                  />
                  {giftSenderTag ? <div className="roseSenderTag">{giftSenderTag}</div> : null}
                  {floatingRoses.map((rose) => (
                    <span
                      key={rose.id}
                      className="floatingRose"
                      style={{
                        left: `${rose.left}%`,
                        fontSize: `${rose.size}px`,
                        ["--rose-drift" as string]: `${rose.drift}px`,
                      }}
                    >
                      🌹
                    </span>
                  ))}
                  <ChatOverlay liveSessionId={session.id} username={viewerIdentity.username} />
                </>
              ) : (
                <div className="feedSwipeHint">Glisse vers le haut ou bas pour changer de live</div>
              )}
            </VideoStage>
          </div>
        );
      })}
    </main>
  );
}
