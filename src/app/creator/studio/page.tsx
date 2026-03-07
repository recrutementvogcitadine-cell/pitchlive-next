"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, MessageSquare, Power, Share2, Sparkles, Users } from "lucide-react";
import JoinTicker from "@/components/live/JoinTicker";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type IAgoraRTCClient = import("agora-rtc-sdk-ng").IAgoraRTCClient;
type ICameraVideoTrack = import("agora-rtc-sdk-ng").ICameraVideoTrack;
type IMicrophoneAudioTrack = import("agora-rtc-sdk-ng").IMicrophoneAudioTrack;

const CAMERA_PROFILE_KEY = "pitchlive.cameraProfile.v1";

type CameraProfile = {
  preferredCameraId?: string;
  preferredCameraLabel?: string;
  preferredFacing?: "environment" | "user";
  beautyPreview: boolean;
  showCameraGuides: boolean;
  updatedAt: number;
};

type JoinTickerItem = {
  id: string;
  name: string;
};

type SellerRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  storeName: string;
  phone: string;
  plan: "jour" | "semaine" | "mois";
  planStartAt: string;
  planEndAt: string;
  status: "pending" | "validated" | "refused";
};

type StudioProduct = {
  id: string;
  name: string;
  price: string;
};

type StudioChatMessage = {
  id: string;
  username: string;
  content: string;
};

const STUDIO_PRODUCTS_KEY = "pitchlive.studio.products";

function isMobileRuntime() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function isRearCameraLabel(label: string) {
  const l = (label || "").toLowerCase();
  return (
    l.includes("back") ||
    l.includes("rear") ||
    l.includes("environment") ||
    l.includes("world") ||
    l.includes("arriere")
  );
}

function getEffectiveNetworkType(): string {
  if (typeof navigator === "undefined") return "unknown";
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
  };
  return nav.connection?.effectiveType ?? "unknown";
}

function getVerticalEncoderConfig() {
  const network = getEffectiveNetworkType();

  // Favor quality while staying resilient on weaker mobile networks.
  if (network === "2g" || network === "slow-2g") {
    return {
      width: 540,
      height: 960,
      frameRate: 30,
      bitrateMax: 1400,
      bitrateMin: 450,
    };
  }

  if (network === "3g") {
    return {
      width: 720,
      height: 1280,
      frameRate: 30,
      bitrateMax: 2200,
      bitrateMin: 700,
    };
  }

  if (isMobileRuntime()) {
    // Mobile quality profile (TikTok-like) on decent connectivity.
    return {
      width: 1080,
      height: 1920,
      frameRate: 30,
      bitrateMax: 4200,
      bitrateMin: 1400,
    };
  }

  return {
    width: 1080,
    height: 1920,
    frameRate: 30,
    bitrateMax: 4500,
    bitrateMin: 1500,
  };
}

async function applyCameraTrackTuning(cameraTrack: ICameraVideoTrack) {
  try {
    const mediaTrack = cameraTrack.getMediaStreamTrack?.();
    if (!mediaTrack || typeof mediaTrack.getCapabilities !== "function") return;

    const caps = mediaTrack.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min?: number; max?: number };
      focusMode?: string[];
      exposureMode?: string[];
    };

    const advanced: Array<Record<string, unknown>> = [];

    // Keep zoom at the minimum supported value to avoid over-cropped selfie framing.
    if (caps.zoom?.min !== undefined) {
      advanced.push({ zoom: caps.zoom.min });
    }

    if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
      advanced.push({ focusMode: "continuous" });
    }

    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
      advanced.push({ exposureMode: "continuous" });
    }

    if (advanced.length) {
      await mediaTrack.applyConstraints({
        advanced: advanced as unknown as MediaTrackConstraintSet[],
      });
    }
  } catch {
    // Best-effort tuning: safely ignore on unsupported browsers/devices.
  }
}

function readCameraProfile(): CameraProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CAMERA_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CameraProfile;
  } catch {
    return null;
  }
}

function writeCameraProfile(profile: CameraProfile) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CAMERA_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore write errors in restricted storage contexts.
  }
}

function clearCameraProfile() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CAMERA_PROFILE_KEY);
  } catch {
    // Ignore clear errors in restricted storage contexts.
  }
}

function formatLiveError(error: unknown): string {
  const text = String(error);
  const normalized = text.toLowerCase();

  if (
    normalized.includes("permission_denied") ||
    normalized.includes("notallowederror") ||
    normalized.includes("permission denied")
  ) {
    return "Acces refuse a la camera/micro. Autorise camera + micro pour ce site puis recharge la page.";
  }

  if (normalized.includes("notfounderror") || normalized.includes("devices not found")) {
    return "Camera ou micro introuvable. Verifie qu'un peripherique audio/video est bien connecte.";
  }

  if (normalized.includes("overconstrainederror") || normalized.includes("constraint")) {
    return "Le navigateur ne peut pas appliquer ce reglage camera. Essaie de changer de camera.";
  }

  return text;
}

function enforcePreviewVideoStyle(containerId: string) {
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

export default function CreatorStudioPage() {
  const [title, setTitle] = useState("Live PITCH LIVE");
  const [busy, setBusy] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewersCount, setViewersCount] = useState(0);
  const [cameraLabel, setCameraLabel] = useState("Auto");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [beautyPreview, setBeautyPreview] = useState(true);
  const [showCameraGuides, setShowCameraGuides] = useState(false);
  const [profileInfo, setProfileInfo] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewOverlayOpen, setPreviewOverlayOpen] = useState(false);
  const [goLiveCountdown, setGoLiveCountdown] = useState<number | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [likesCount, setLikesCount] = useState(0);
  const [newFollowersDuringLive, setNewFollowersDuringLive] = useState(0);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [followersNotice, setFollowersNotice] = useState<string | null>(null);
  const [announceFollowersNotice, setAnnounceFollowersNotice] = useState(false);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [joinTickerItems, setJoinTickerItems] = useState<JoinTickerItem[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [sellerWhatsappNumber, setSellerWhatsappNumber] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [sellerRegistration, setSellerRegistration] = useState<SellerRegistration | null>(null);
  const [forfaitRemaining, setForfaitRemaining] = useState("--");
  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [productDraft, setProductDraft] = useState({ name: "", price: "" });
  const [chatMessages, setChatMessages] = useState<StudioChatMessage[]>([]);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const preferredCameraIdRef = useRef<string | null>(null);
  const goLiveCountdownTimerRef = useRef<number | null>(null);
  const countdownAudioContextRef = useRef<AudioContext | null>(null);
  const joinNoticeTimeoutRef = useRef<number | null>(null);
  const followersNoticeTimeoutRef = useRef<number | null>(null);
  const announceNoticeTimeoutRef = useRef<number | null>(null);

  const creatorId = "main-creator";

  const playTrackInPreview = (track: ICameraVideoTrack, target: "hidden" | "overlay") => {
    const containerId = target === "overlay" ? "creator-preview-overlay" : "creator-preview";
    track.play(containerId, { fit: "contain", mirror: false });
    enforcePreviewVideoStyle(containerId);
  };

  const openAdminWhatsapp = () => {
    const raw = env.sellerWhatsapp || "2250700000000";
    const normalized = raw.replace(/[^\d+]/g, "");
    if (!normalized || typeof window === "undefined") return;
    const message = [
      "Bonjour equipe admin PITCH LIVE,",
      "mon inscription vendeur est en attente de validation.",
      "Merci de verifier mon dossier.",
    ].join("\n");
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const clearGoLiveCountdown = () => {
    if (goLiveCountdownTimerRef.current) {
      window.clearInterval(goLiveCountdownTimerRef.current);
      goLiveCountdownTimerRef.current = null;
    }
    setGoLiveCountdown(null);
  };

  const playCountdownBeep = (count: number) => {
    if (typeof window === "undefined") return;

    try {
      const WinWithWebkitAudio = window as Window & {
        webkitAudioContext?: typeof AudioContext;
      };

      const AudioCtor = window.AudioContext || WinWithWebkitAudio.webkitAudioContext;
      if (!AudioCtor) return;

      if (!countdownAudioContextRef.current || countdownAudioContextRef.current.state === "closed") {
        countdownAudioContextRef.current = new AudioCtor();
      }

      const ctx = countdownAudioContextRef.current;
      if (!ctx) return;
      void ctx.resume();

      const frequency = count === 3 ? 640 : count === 2 ? 780 : 940;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.085, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio feedback is best effort only.
    }
  };

  const beginGoLiveCountdown = () => {
    if (busy || isLive || !previewReady) return;

    clearGoLiveCountdown();
    let remaining = 3;
    setGoLiveCountdown(remaining);
    playCountdownBeep(remaining);

    goLiveCountdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearGoLiveCountdown();
        void startLive();
        return;
      }
      setGoLiveCountdown(remaining);
      playCountdownBeep(remaining);
    }, 1000);
  };

  const appendJoinTicker = (name: string, id: string) => {
    setJoinTickerItems((prev) => [{ id, name }, ...prev].slice(0, 8));
    setParticipants((prev) => {
      if (prev.includes(name)) return prev;
      return [name, ...prev].slice(0, 30);
    });

    setJoinNotice(`${name} a rejoint`);
    if (joinNoticeTimeoutRef.current) {
      window.clearTimeout(joinNoticeTimeoutRef.current);
    }
    joinNoticeTimeoutRef.current = window.setTimeout(() => {
      setJoinNotice(null);
      joinNoticeTimeoutRef.current = null;
    }, 2600);
  };

  const getPresenceName = (userId: string) => {
    if (userId === creatorId) return "Vendeur";
    return `visiteur_${userId.slice(0, 4)}`;
  };

  useEffect(() => {
    const profile = readCameraProfile();
    if (!profile) return;

    setBeautyPreview(profile.beautyPreview);
    setShowCameraGuides(profile.showCameraGuides);
    if (profile.preferredCameraId) {
      preferredCameraIdRef.current = profile.preferredCameraId;
    }
    if (profile.preferredCameraLabel) {
      setCameraLabel(profile.preferredCameraLabel);
    }
    if (profile.preferredFacing) {
      setCameraFacing(profile.preferredFacing);
    }
    setProfileInfo("Profil camera charge");
    window.setTimeout(() => setProfileInfo(null), 1800);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawAccess = window.localStorage.getItem("pitchlive.access");
      const access = rawAccess ? (JSON.parse(rawAccess) as { visitor?: boolean; seller?: boolean }) : null;
      if (!access?.seller) {
        window.location.href = "/mur";
        return;
      }
    } catch {
      window.location.href = "/login";
      return;
    }

    const loadSellerRegistration = () => {
      const rawRegistration = window.localStorage.getItem("pitchlive.seller.registration");
      if (!rawRegistration) {
        setSellerRegistration(null);
        return;
      }
      try {
        const parsed = JSON.parse(rawRegistration) as SellerRegistration;
        setSellerRegistration(parsed);

        if (parsed.status === "refused") {
          window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: false, seller: false }));
          window.location.href = "/vendeur/inscription";
        }
      } catch {
        setSellerRegistration(null);
      }
    };

    loadSellerRegistration();

    const poll = window.setInterval(loadSellerRegistration, 2500);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "pitchlive.seller.registration") {
        loadSellerRegistration();
      }
    };
    window.addEventListener("storage", onStorage);

    const rawProducts = window.localStorage.getItem(STUDIO_PRODUCTS_KEY);
    if (rawProducts) {
      try {
        setProducts(JSON.parse(rawProducts) as StudioProduct[]);
      } catch {
        setProducts([]);
      }
    }

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const resyncCountdown = () => {
      if (!sellerRegistration?.planEndAt) {
        setForfaitRemaining("--");
        return;
      }

      const now = Date.now();
      const endAt = new Date(sellerRegistration.planEndAt).getTime();
      const diff = endAt - now;
      if (diff <= 0) {
        setForfaitRemaining("Expire");
        return;
      }

      const totalMinutes = Math.floor(diff / 60000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;
      setForfaitRemaining(`${days}j ${hours}h ${minutes}m`);
    };

    resyncCountdown();
    const timer = window.setInterval(resyncCountdown, 30000);
    return () => window.clearInterval(timer);
  }, [sellerRegistration]);

  useEffect(() => {
    let mounted = true;

    const loadSellerProfile = async () => {
      try {
        const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent(creatorId)}`, { cache: "no-store" });
        const body = (await res.json()) as { profile?: { whatsappNumber?: string } | null };
        if (!mounted) return;
        setSellerWhatsappNumber(body.profile?.whatsappNumber ?? "");
      } catch {
        if (!mounted) return;
        setSellerWhatsappNumber("");
      }
    };

    void loadSellerProfile();

    return () => {
      mounted = false;
    };
  }, [creatorId]);

  useEffect(() => {
    if (!isLive || !sessionId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`live-presence-studio-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_presence", filter: `live_session_id=eq.${sessionId}` },
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
  }, [isLive, sessionId]);

  useEffect(() => {
    if (!isLive || !sessionId) return;

    const supabase = createClient();
    let mounted = true;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,username,content")
        .eq("live_session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!mounted) return;
      setChatMessages(((data as StudioChatMessage[] | null) ?? []).reverse());
    };

    void loadMessages();

    const channel = supabase
      .channel(`studio-chat-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `live_session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as StudioChatMessage;
          setChatMessages((prev) => [...prev.slice(-11), row]);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [isLive, sessionId]);

  useEffect(() => {
    return () => {
      clearGoLiveCountdown();

      if (countdownAudioContextRef.current && countdownAudioContextRef.current.state !== "closed") {
        void countdownAudioContextRef.current.close();
      }

      if (joinNoticeTimeoutRef.current) {
        window.clearTimeout(joinNoticeTimeoutRef.current);
      }
      if (followersNoticeTimeoutRef.current) {
        window.clearTimeout(followersNoticeTimeoutRef.current);
      }
      if (announceNoticeTimeoutRef.current) {
        window.clearTimeout(announceNoticeTimeoutRef.current);
      }

      void clientRef.current?.leave();
      camRef.current?.stop();
      micRef.current?.stop();
      camRef.current?.close();
      micRef.current?.close();
      clientRef.current = null;
      camRef.current = null;
      micRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isLive || !sessionId) return;

    const supabase = createClient();
    let mounted = true;

    const loadLiveStats = async () => {
      const likes = await supabase.from("likes").select("id", { count: "exact", head: true }).eq("live_session_id", sessionId);
      if (!mounted) return;
      setLikesCount(likes.count ?? 0);
    };

    void loadLiveStats();

    const channel = supabase
      .channel(`studio-stats-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes", filter: `live_session_id=eq.${sessionId}` },
        () => {
          setLikesCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "followers", filter: `creator_id=eq.${creatorId}` },
        () => {
          setNewFollowersDuringLive((prev) => prev + 1);
          setFollowersNotice("Nouveau follower recu pendant le live");
          if (followersNoticeTimeoutRef.current) {
            window.clearTimeout(followersNoticeTimeoutRef.current);
          }
          followersNoticeTimeoutRef.current = window.setTimeout(() => {
            setFollowersNotice(null);
            followersNoticeTimeoutRef.current = null;
          }, 2800);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [isLive, sessionId, creatorId]);

  const saveCameraProfile = (cameraId?: string, cameraName?: string) => {
    const profile: CameraProfile = {
      preferredCameraId: cameraId ?? preferredCameraIdRef.current ?? undefined,
      preferredCameraLabel: cameraName ?? cameraLabel,
      preferredFacing: cameraFacing,
      beautyPreview,
      showCameraGuides,
      updatedAt: Date.now(),
    };

    writeCameraProfile(profile);
    if (profile.preferredCameraId) {
      preferredCameraIdRef.current = profile.preferredCameraId;
    }

    setProfileInfo("Profil camera sauvegarde");
    window.setTimeout(() => setProfileInfo(null), 1800);
  };

  const resetCameraProfile = () => {
    clearCameraProfile();
    preferredCameraIdRef.current = null;
    setCameraLabel("Auto");
    setCameraFacing("environment");
    setBeautyPreview(true);
    setShowCameraGuides(false);
    setProfileInfo("Profil camera reinitialise");
    window.setTimeout(() => setProfileInfo(null), 1800);
  };

  const choosePreferredCameraId = async (
    AgoraRTC: typeof import("agora-rtc-sdk-ng").default,
    facingPreference: "environment" | "user"
  ) => {
    const cameras = (await AgoraRTC.getCameras()) as Array<{ deviceId: string; label: string }>;
    if (!cameras.length) return undefined;

    const rearCameras = cameras.filter((camera) => isRearCameraLabel(camera.label));
    const frontCameras = cameras.filter((camera) => !isRearCameraLabel(camera.label));

    const candidates =
      facingPreference === "environment"
        ? rearCameras.length
          ? rearCameras
          : cameras
        : frontCameras.length
        ? frontCameras
        : cameras;

    const rememberedId = preferredCameraIdRef.current;
    if (rememberedId) {
      const remembered = candidates.find((camera) => camera.deviceId === rememberedId);
      if (remembered) {
        setCameraLabel(remembered.label || "Camera");
        return remembered.deviceId;
      }
    }

    // Rear-camera lock: prefer back camera, avoid ultra-wide/tele where possible.
    const ranked = [...candidates].sort((a, b) => {
      const score = (label: string) => {
        const l = (label || "").toLowerCase();
        let s = 0;

        if (l.includes("back") || l.includes("rear") || l.includes("environment")) s -= 20;
        if (l.includes("ultra") || l.includes("wide") || l.includes("0.5") || l.includes("fisheye")) s += 10;
        if (l.includes("tele") || l.includes("zoom")) s += 8;
        if (l.includes("main") || l.includes("normal") || l.includes("1x")) s -= 3;

        return s;
      };
      return score(a.label) - score(b.label);
    });

    const picked = ranked[0];
    setCameraLabel(picked.label || "Camera");
    return picked.deviceId;
  };

  const createCameraTrackForFacing = async (
    AgoraRTC: typeof import("agora-rtc-sdk-ng").default,
    facing: "environment" | "user"
  ) => {
    const cameras = (await AgoraRTC.getCameras()) as Array<{ deviceId: string; label: string }>;
    const rearCameras = cameras.filter((camera) => isRearCameraLabel(camera.label));
    const frontCameras = cameras.filter((camera) => !isRearCameraLabel(camera.label));

    const pickedRear = rearCameras[0] ?? cameras[0];
    const pickedFront = frontCameras[0] ?? cameras[0];

    const attempts: Array<() => Promise<ICameraVideoTrack>> = [];

    if (facing === "environment") {
      if (pickedRear?.deviceId) {
        attempts.push(() =>
          AgoraRTC.createCameraVideoTrack({
            cameraId: pickedRear.deviceId,
            facingMode: "environment",
            encoderConfig: getVerticalEncoderConfig(),
            optimizationMode: "detail",
          })
        );
      }

      attempts.push(() =>
        AgoraRTC.createCameraVideoTrack({
          facingMode: "environment",
          encoderConfig: getVerticalEncoderConfig(),
          optimizationMode: "detail",
        })
      );
    } else {
      if (pickedFront?.deviceId) {
        attempts.push(() =>
          AgoraRTC.createCameraVideoTrack({
            cameraId: pickedFront.deviceId,
            facingMode: "user",
            encoderConfig: getVerticalEncoderConfig(),
            optimizationMode: "detail",
          })
        );
      }

      attempts.push(() =>
        AgoraRTC.createCameraVideoTrack({
          facingMode: "user",
          encoderConfig: getVerticalEncoderConfig(),
          optimizationMode: "detail",
        })
      );
    }

    // Last-resort default to avoid hard failure on devices with broken metadata.
    attempts.push(() =>
      AgoraRTC.createCameraVideoTrack({
        encoderConfig: getVerticalEncoderConfig(),
        optimizationMode: "detail",
      })
    );

    let lastError: unknown = null;
    for (const run of attempts) {
      try {
        const track = await run();
        const label = facing === "user" ? pickedFront?.label || "Camera avant" : pickedRear?.label || "Camera arriere";
        const cameraId = facing === "user" ? pickedFront?.deviceId ?? null : pickedRear?.deviceId ?? null;
        return { track, label, cameraId };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Impossible de creer la camera pour ce mode.");
  };

  const initializePreview = async () => {
    if (!env.agoraAppId) {
      setError("NEXT_PUBLIC_AGORA_APP_ID manquant.");
      return;
    }

    if (camRef.current && micRef.current) {
      setPreviewReady(true);
      return;
    }

    if (!window.isSecureContext) {
      setError("La preview camera/micro exige HTTPS (ou localhost en local).");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          AEC: true,
          AGC: true,
          ANS: true,
        },
        {
          cameraId: undefined,
          facingMode: cameraFacing,
          encoderConfig: getVerticalEncoderConfig(),
          optimizationMode: "detail",
        }
      );

      // Replace initial track with robust facing-aware selection when needed.
      const preferredCamera = await createCameraTrackForFacing(AgoraRTC, cameraFacing);
      cameraTrack.stop();
      cameraTrack.close();
      const selectedCameraTrack = preferredCamera.track;

      await applyCameraTrackTuning(selectedCameraTrack);

      playTrackInPreview(selectedCameraTrack, "hidden");

      camRef.current = selectedCameraTrack;
      micRef.current = microphoneTrack;
      setPreviewReady(true);
      setCameraLabel(preferredCamera.label);
      preferredCameraIdRef.current = preferredCamera.cameraId;

      await cameraTrack.setEnabled(cameraEnabled);
      await microphoneTrack.setEnabled(microphoneEnabled);
    } catch (err) {
      setError(formatLiveError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleCameraInput = async () => {
    if (!camRef.current) {
      await initializePreview();
      if (!camRef.current) return;
    }

    const next = !cameraEnabled;
    setCameraEnabled(next);
    try {
      await camRef.current.setEnabled(next);
    } catch {
      setError("Impossible de modifier la camera pour le moment.");
    }
  };

  const toggleMicrophoneInput = async () => {
    if (!micRef.current) {
      await initializePreview();
      if (!micRef.current) return;
    }

    const next = !microphoneEnabled;
    setMicrophoneEnabled(next);
    try {
      await micRef.current.setEnabled(next);
    } catch {
      setError("Impossible de modifier le micro pour le moment.");
    }
  };

  const startLive = async () => {
    if (!env.agoraAppId) {
      setError("NEXT_PUBLIC_AGORA_APP_ID manquant.");
      return;
    }

    if (!sellerRegistration || sellerRegistration.status !== "validated") {
      setError("Validation admin obligatoire: statut vendeur non valide.");
      return;
    }

    setBusy(true);
    setError(null);
    clearGoLiveCountdown();

    try {
      if (!window.isSecureContext) {
        setError("Le live camera/micro exige HTTPS (ou localhost en local). Ouvre l'app sur https://www.pitchci.com.");
        return;
      }

      await initializePreview();
      if (!camRef.current || !micRef.current) {
        setError("Preview camera/micro indisponible. Autorise camera + micro puis reessaie.");
        return;
      }

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const response = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, creatorId }),
      });
      if (!response.ok) {
        const failedBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(failedBody.error ?? "Impossible de demarrer la session live.");
      }
      const body = (await response.json()) as { sessionId: string; channelName: string; token: string };

      // Use H264 for better interoperability on mobile Safari and older devices.
      const rtc = AgoraRTC.createClient({ mode: "live", codec: "h264" });
      clientRef.current = rtc;

      // Enable dual stream so Agora can adapt better to network fluctuations.
      await rtc.enableDualStream();
      await rtc.setLowStreamParameter({
        width: 320,
        height: 180,
        framerate: 15,
        bitrate: 140,
      });

      await rtc.setClientRole("host");
      await rtc.join(env.agoraAppId, body.channelName, body.token, null);

      // Keep preview and broadcast identical (same tracks, same framing).
      await rtc.publish([micRef.current, camRef.current]);

      setSessionId(body.sessionId);
      setIsLive(true);
      setPreviewOverlayOpen(true);
      setNewFollowersDuringLive(0);
      setShowAdvancedMenu(false);
      setAnnounceFollowersNotice(true);
      if (announceNoticeTimeoutRef.current) {
        window.clearTimeout(announceNoticeTimeoutRef.current);
      }
      announceNoticeTimeoutRef.current = window.setTimeout(() => {
        setAnnounceFollowersNotice(false);
        announceNoticeTimeoutRef.current = null;
      }, 5200);
      saveCameraProfile(preferredCameraIdRef.current ?? undefined, cameraLabel);

      const supabase = createClient();
      const interval = window.setInterval(async () => {
        const { count } = await supabase
          .from("live_presence")
          .select("id", { count: "exact", head: true })
          .eq("live_session_id", body.sessionId);
        setViewersCount(count ?? 0);
      }, 3000);

      (window as unknown as { __viewerInterval?: number }).__viewerInterval = interval;

      setPreviewReady(true);
    } catch (err) {
      setError(formatLiveError(err));
    } finally {
      setBusy(false);
    }
  };

  const switchCamera = async () => {
    if (!camRef.current) {
      await initializePreview();
      if (!camRef.current) return;
    }

    setBusy(true);

    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const cameras = (await AgoraRTC.getCameras()) as Array<{ deviceId: string; label: string }>;
      const rearCameras = cameras.filter((camera) => isRearCameraLabel(camera.label));
      const frontCameras = cameras.filter((camera) => !isRearCameraLabel(camera.label));

      const candidates =
        cameraFacing === "environment" ? (rearCameras.length ? rearCameras : cameras) : frontCameras.length ? frontCameras : cameras;

      if (candidates.length < 2) {
        setError(
          cameraFacing === "environment"
            ? "Camera arriere verrouillee: une seule camera arriere detectee."
            : "Camera frontale verrouillee: une seule camera frontale detectee."
        );
        return;
      }

      const activeClient = clientRef.current;
      const currentCameraId = preferredCameraIdRef.current;
      const currentLabel = (cameraLabel || "").toLowerCase();
      const currentIndex =
        candidates.findIndex((camera) => camera.deviceId === currentCameraId) >= 0
          ? candidates.findIndex((camera) => camera.deviceId === currentCameraId)
          : candidates.findIndex((camera) => (camera.label || "").toLowerCase() === currentLabel);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % candidates.length : 0;
      const nextCamera = candidates[nextIndex];
      const previousTrack = camRef.current;

      const nextCameraTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: nextCamera.deviceId,
        facingMode: cameraFacing,
        encoderConfig: getVerticalEncoderConfig(),
        optimizationMode: "detail",
      });

      await applyCameraTrackTuning(nextCameraTrack);
      playTrackInPreview(nextCameraTrack, previewOverlayOpen ? "overlay" : "hidden");

      let unpublishedOldTrack = false;
      try {
        if (previousTrack && activeClient && isLive) {
          await activeClient.unpublish(previousTrack);
          unpublishedOldTrack = true;
        }
        if (activeClient && isLive) {
          await activeClient.publish(nextCameraTrack);
        }
      } catch (publishError) {
        if (unpublishedOldTrack && previousTrack && activeClient) {
          try {
            await activeClient.publish(previousTrack);
          } catch {
            // Keep original error context.
          }
        }
        nextCameraTrack.stop();
        nextCameraTrack.close();
        throw publishError;
      }

      if (previousTrack) {
        previousTrack.stop();
        previousTrack.close();
      }
      camRef.current = nextCameraTrack;

      setCameraLabel(nextCamera.label || `Camera ${nextIndex + 1}`);
      preferredCameraIdRef.current = nextCamera.deviceId;
      saveCameraProfile(nextCamera.deviceId, nextCamera.label || `Camera ${nextIndex + 1}`);
      setError(null);
    } catch (err) {
      setError(formatLiveError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleFacing = async () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    try {
      saveCameraProfile();
    } catch {
      // ignore
    }

    if (!camRef.current) {
      await initializePreview();
      if (!camRef.current) return;
    }

    setBusy(true);
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const activeClient = clientRef.current;
      const previousTrack = camRef.current;
      const selectedCamera = await createCameraTrackForFacing(AgoraRTC, nextFacing);
      const nextCameraTrack = selectedCamera.track;

      await applyCameraTrackTuning(nextCameraTrack);
      playTrackInPreview(nextCameraTrack, previewOverlayOpen ? "overlay" : "hidden");

      let unpublishedOldTrack = false;
      try {
        if (previousTrack && activeClient && isLive) {
          await activeClient.unpublish(previousTrack);
          unpublishedOldTrack = true;
        }
        if (activeClient && isLive) {
          await activeClient.publish(nextCameraTrack);
        }
      } catch (err) {
        if (unpublishedOldTrack && previousTrack && activeClient) {
          try {
            await activeClient.publish(previousTrack);
          } catch {
            // keep original error
          }
        }
        nextCameraTrack.stop();
        nextCameraTrack.close();
        throw err;
      }

      if (previousTrack) {
        previousTrack.stop();
        previousTrack.close();
      }
      camRef.current = nextCameraTrack;

      setCameraLabel(selectedCamera.label);
      preferredCameraIdRef.current = selectedCamera.cameraId;
      saveCameraProfile(selectedCamera.cameraId ?? undefined, selectedCamera.label);
      setError(null);
    } catch (err) {
      setError(formatLiveError(err));
    } finally {
      setBusy(false);
    }
  };

  const stopLive = async () => {
    setBusy(true);
    setError(null);
    clearGoLiveCountdown();

    try {
      if (sessionId) {
        await fetch("/api/live/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }

      await clientRef.current?.leave();
      clientRef.current = null;

      camRef.current?.stop();
      micRef.current?.stop();
      camRef.current?.close();
      micRef.current?.close();
      camRef.current = null;
      micRef.current = null;

      const previewContainer = document.getElementById("creator-preview");
      if (previewContainer) {
        previewContainer.innerHTML = "";
      }

      const holder = window as unknown as { __viewerInterval?: number };
      if (holder.__viewerInterval) {
        window.clearInterval(holder.__viewerInterval);
        holder.__viewerInterval = undefined;
      }

      setIsLive(false);
      setPreviewOverlayOpen(false);
      setSessionId(null);
      setViewersCount(0);
      setPreviewReady(false);
      setCameraEnabled(true);
      setMicrophoneEnabled(true);
      setLikesCount(0);
      setNewFollowersDuringLive(0);
      setJoinNotice(null);
      setFollowersNotice(null);
      setAnnounceFollowersNotice(false);
      setShowAdvancedMenu(false);
    } catch (err) {
      setError(formatLiveError(err));
    } finally {
      setBusy(false);
    }
  };

  const addProduct = () => {
    const name = productDraft.name.trim();
    const price = productDraft.price.trim();
    if (!name || !price) return;

    const next = [{ id: crypto.randomUUID(), name, price }, ...products].slice(0, 20);
    setProducts(next);
    setProductDraft({ name: "", price: "" });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDIO_PRODUCTS_KEY, JSON.stringify(next));
    }
  };

  const removeProduct = (id: string) => {
    const next = products.filter((product) => product.id !== id);
    setProducts(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDIO_PRODUCTS_KEY, JSON.stringify(next));
    }
  };

  const saveSellerWhatsapp = async () => {
    setSavingWhatsapp(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: creatorId,
          storeName: sellerRegistration?.storeName || "Vendeur principal",
          tagline: "Boutique live en direct",
          whatsappNumber: sellerWhatsappNumber,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Impossible de sauvegarder le WhatsApp vendeur.");
      }
      setProfileInfo("WhatsApp vendeur sauvegarde");
      window.setTimeout(() => setProfileInfo(null), 1800);
    } catch (err) {
      setError(formatLiveError(err));
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const openLivePreview = async () => {
    if (!sellerRegistration || sellerRegistration.status !== "validated") {
      setError("Validation admin requise avant previsualisation.");
      return;
    }

    setError(null);
    clearGoLiveCountdown();
    setPreviewOverlayOpen(true);

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await initializePreview();

    if (!camRef.current) {
      setPreviewOverlayOpen(false);
      return;
    }

    playTrackInPreview(camRef.current, "overlay");
  };

  const openSellerStore = () => {
    if (typeof window === "undefined") return;
    window.open(`/boutique/${encodeURIComponent(creatorId)}`, "_blank", "noopener,noreferrer");
  };

  const closePreviewOverlay = () => {
    clearGoLiveCountdown();
    setPreviewOverlayOpen(false);
  };

  useEffect(() => {
    if (!previewOverlayOpen || !camRef.current) return;
    playTrackInPreview(camRef.current, "overlay");
  }, [previewOverlayOpen]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 md:p-8">
      <section className="mx-auto max-w-4xl grid gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Studio Vendeur</h1>
          <div className="flex gap-2">
            <Link href="/creator/settings" className="rounded-full bg-slate-700 px-4 py-2 font-semibold">
              Parametres vendeur
            </Link>
            <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">
              Voir le live public
            </Link>
          </div>
        </div>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3">
          <div className="rounded-xl border border-violet-500/35 bg-violet-900/15 p-3 md:p-4 grid gap-2">
            <h2 className="text-sm md:text-base font-bold text-violet-100">Parametres camera</h2>
            <div className="text-xs md:text-sm text-violet-100/90 grid gap-1">
              <p>Camera active: <strong>{cameraLabel || "Auto"}</strong></p>
              <p>Mode camera: <strong>{cameraFacing === "environment" ? "ARRIERE" : "AVANT"}</strong></p>
              <p>Format live: <strong>9:16 vertical</strong></p>
              <p>Miroir audience: <strong>OFF</strong> (orientation normale)</p>
              <p>Optimisation mobile: <strong>ON</strong> (cadrage stable, anti-zoom)</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => saveCameraProfile()}
                className="rounded-lg border border-violet-400/60 bg-violet-800/35 px-3 py-2 text-xs md:text-sm font-semibold"
              >
                Sauver profil camera
              </button>
              <button
                type="button"
                onClick={resetCameraProfile}
                className="rounded-lg border border-slate-500/70 bg-slate-800/60 px-3 py-2 text-xs md:text-sm font-semibold"
              >
                Reinitialiser profil
              </button>
              <button
                    type="button"
                    onClick={() => void toggleFacing()}
                className="rounded-lg border border-sky-400/60 bg-sky-800/25 px-3 py-2 text-xs md:text-sm font-semibold"
              >
                Caméra: {cameraFacing === "environment" ? "ARRIÈRE" : "AVANT"}
              </button>
            </div>
          </div>

          <label className="grid gap-1 text-sm">
            Titre du live
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void openLivePreview()}
              disabled={busy || isLive || !sellerRegistration || sellerRegistration.status !== "validated"}
              className="rounded-xl bg-fuchsia-600 px-4 py-3 font-bold disabled:opacity-50"
            >
              {busy && !isLive ? "Ouverture preview..." : !sellerRegistration || sellerRegistration.status !== "validated" ? "Validation admin requise" : "Previsualiser le live"}
            </button>

            <button
              type="button"
              onClick={() => void stopLive()}
              disabled={busy || !isLive}
              className="rounded-xl bg-slate-700 px-4 py-3 font-bold disabled:opacity-50"
            >
              {busy && isLive ? "Arret..." : "Arreter le live"}
            </button>

            <button
              type="button"
              onClick={() => void toggleCameraInput()}
              disabled={busy}
              className="rounded-xl border border-emerald-500/60 bg-emerald-900/20 px-4 py-3 font-semibold disabled:opacity-50"
            >
              Camera: {cameraEnabled ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={() => void toggleMicrophoneInput()}
              disabled={busy}
              className="rounded-xl border border-amber-500/60 bg-amber-900/20 px-4 py-3 font-semibold disabled:opacity-50"
            >
              Micro: {microphoneEnabled ? "ON" : "OFF"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void switchCamera()}
              disabled={!previewReady || busy}
            className="rounded-xl border border-slate-500 bg-slate-800 px-4 py-3 font-semibold disabled:opacity-50"
          >
            Changer camera arriere ({cameraLabel || "Auto"})
          </button>

          <button
            type="button"
            onClick={() => {
              setBeautyPreview((prev) => {
                const next = !prev;
                const cameraProfile: CameraProfile = {
                  preferredCameraId: preferredCameraIdRef.current ?? undefined,
                  preferredCameraLabel: cameraLabel,
                  beautyPreview: next,
                  showCameraGuides,
                  updatedAt: Date.now(),
                };
                writeCameraProfile(cameraProfile);
                return next;
              });
            }}
            className="rounded-xl border border-emerald-500/60 bg-emerald-900/20 px-4 py-3 font-semibold"
          >
            {beautyPreview ? "Beaute legere: ON" : "Beaute legere: OFF"}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCameraGuides((prev) => {
                const next = !prev;
                const cameraProfile: CameraProfile = {
                  preferredCameraId: preferredCameraIdRef.current ?? undefined,
                  preferredCameraLabel: cameraLabel,
                  beautyPreview,
                  showCameraGuides: next,
                  updatedAt: Date.now(),
                };
                writeCameraProfile(cameraProfile);
                return next;
              });
            }}
            className="rounded-xl border border-sky-500/60 bg-sky-900/20 px-4 py-3 font-semibold"
          >
            {showCameraGuides ? "Guides cadrage: ON" : "Guides cadrage: OFF"}
          </button>

          <div className="text-sm text-slate-300">
            Etat: <strong>{isLive ? "En direct" : "Hors ligne"}</strong> • Preview: <strong>{previewReady ? "OK" : "NON"}</strong> • Ecran previsualisation: <strong>{previewOverlayOpen ? "OUVERT" : "FERME"}</strong> • Video: <strong>{cameraEnabled ? "ON" : "OFF"}</strong> • Audio: <strong>{microphoneEnabled ? "ON" : "OFF"}</strong> • Spectateurs connectes: {viewersCount}
          </div>

          <div className="text-sm text-slate-300">
            Forfait: <strong>{sellerRegistration?.plan?.toUpperCase() || "AUCUN"}</strong> • Debut: <strong>{sellerRegistration?.planStartAt ? new Date(sellerRegistration.planStartAt).toLocaleString("fr-FR") : "--"}</strong> • Fin: <strong>{sellerRegistration?.planEndAt ? new Date(sellerRegistration.planEndAt).toLocaleString("fr-FR") : "--"}</strong> • Compte a rebours: <strong>{forfaitRemaining}</strong>
          </div>

          <div className="text-sm text-slate-300">
            Statut vendeur: <strong>{sellerRegistration?.status === "validated" ? "VALIDE" : sellerRegistration?.status === "refused" ? "REFUSE" : sellerRegistration?.status === "pending" ? "EN ATTENTE" : "NON DEFINI"}</strong>
          </div>

          {sellerRegistration?.status === "pending" ? (
            <div className="rounded-xl border border-amber-500/60 bg-amber-900/20 p-3 grid gap-2">
              <p className="text-sm text-amber-100">
                En attente de validation admin pour debloquer les fonctionnalites du studio live.
              </p>
              <button
                type="button"
                onClick={openAdminWhatsapp}
                className="w-full sm:w-auto rounded-xl bg-emerald-600 px-4 py-2 font-semibold"
              >
                Contacter nous par WhatsApp
              </button>
            </div>
          ) : null}

          {sellerRegistration && sellerRegistration.status !== "validated" ? (
            <p className="text-xs text-amber-200">
              Live bloque tant que le statut vendeur n'est pas VALIDE. Va sur <Link href="/vendeur/statut" className="underline">/vendeur/statut</Link>.
            </p>
          ) : null}

          {isLive ? <JoinTicker items={joinTickerItems} mode="inline" /> : null}

          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
          {profileInfo ? <p className="text-sm text-violet-200">{profileInfo}</p> : null}
        </article>

        <div className="hidden">
          <div id="creator-preview" />
        </div>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
          <h2 className="font-semibold">WhatsApp vendeur (bouton cote client)</h2>
          <label className="grid gap-1 text-sm">
            Numero WhatsApp
            <input
              value={sellerWhatsappNumber}
              onChange={(event) => setSellerWhatsappNumber(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="2250701234567"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveSellerWhatsapp()}
            disabled={savingWhatsapp}
            className="rounded-xl bg-emerald-600 px-4 py-3 font-bold disabled:opacity-50"
          >
            {savingWhatsapp ? "Sauvegarde..." : "Sauvegarder WhatsApp vendeur"}
          </button>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
          <h2 className="font-semibold">Produits rapides studio</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              value={productDraft.name}
              onChange={(event) => setProductDraft((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Nom produit"
            />
            <input
              value={productDraft.price}
              onChange={(event) => setProductDraft((prev) => ({ ...prev, price: event.target.value }))}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Prix (XOF)"
            />
            <button type="button" onClick={addProduct} className="rounded-xl bg-blue-600 px-3 py-2 font-semibold">
              Ajouter produit
            </button>
          </div>

          <div className="grid gap-2">
            {products.length ? (
              products.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <strong>{product.name}</strong> • {product.price}
                  </p>
                  <button type="button" onClick={() => removeProduct(product.id)} className="rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold">
                    Supprimer
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-300">Aucun produit ajoute pour le moment.</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <h2 className="font-semibold">Visiteurs ayant participe</h2>
            <div className="max-h-44 overflow-auto grid gap-2 pr-1">
              {participants.length ? (
                participants.map((name) => (
                  <div key={name} className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm">
                    {name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-300">Aucun participant enregistre pour ce live.</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <h2 className="font-semibold">Chat en direct (monitoring)</h2>
            <div className="max-h-44 overflow-auto grid gap-2 pr-1">
              {chatMessages.length ? (
                chatMessages.map((message) => (
                  <p key={message.id} className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm">
                    <strong>{message.username}</strong> {message.content}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-300">Messages du live indisponibles pour le moment.</p>
              )}
            </div>
          </div>
        </article>
      </section>

      {previewOverlayOpen ? (
        <div className="fixed inset-0 z-[90] bg-black">
          <div
            id="creator-preview-overlay"
            className="absolute inset-0"
            style={{
              filter: beautyPreview ? "brightness(1.05) contrast(1.06) saturate(1.08)" : "none",
            }}
          />

          {showCameraGuides ? (
            <div className="pointer-events-none absolute inset-0 z-[95]">
              <div className="absolute inset-4 border-2 border-sky-300/70 rounded-3xl" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-sky-300/60" />
              <div className="absolute left-0 right-0 top-1/3 h-px bg-sky-300/40" />
              <div className="absolute left-0 right-0 top-2/3 h-px bg-sky-300/40" />
            </div>
          ) : null}

          <div className="absolute inset-x-0 top-0 z-[96] p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 text-white">
              <div className="flex items-center gap-2 rounded-2xl bg-black/45 px-2.5 py-2 backdrop-blur">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/30 bg-slate-900">
                  <img src="/icons/preview-logo-v2.svg" alt="Profil vendeur" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight">{sellerRegistration?.storeName || "Boutique vendeur"}</p>
                  <p className="text-xs text-white/85">Nouveaux abonnes live: +{newFollowersDuringLive}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-sm font-bold text-orange-500">
                  <span>❤</span>
                  <span>{likesCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full bg-black/45 px-3 py-2 text-sm font-semibold">
                  <Users size={14} />
                  <span>{viewersCount}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void stopLive()}
                  disabled={busy || !isLive}
                  className="rounded-full bg-black/55 p-2 text-white disabled:opacity-50"
                  aria-label="Arreter la diffusion"
                >
                  <Power size={18} />
                </button>
              </div>
            </div>

            <div className="mt-3 inline-flex rounded-full bg-black/45 px-3 py-1 text-xs text-white/90">
              {isLive ? "LIVE en direct" : "Apercu avant diffusion"}
            </div>

            {announceFollowersNotice ? (
              <div className="mt-3 inline-flex rounded-xl bg-black/55 px-3 py-2 text-sm text-white/95">
                Nous prevenons tes utilisateurs que tu passes en LIVE.
              </div>
            ) : null}

            {followersNotice ? (
              <div className="mt-2 inline-flex rounded-xl bg-emerald-500/85 px-3 py-2 text-sm font-semibold text-white">
                {followersNotice}
              </div>
            ) : null}

            {joinNotice ? (
              <div className="mt-2 inline-flex rounded-xl bg-black/55 px-3 py-2 text-sm text-white/95">
                {joinNotice}
              </div>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-[97] p-4 md:p-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
            <div className="mx-auto max-w-xl grid gap-3">
              {!isLive ? (
                <button
                  type="button"
                  onClick={beginGoLiveCountdown}
                  disabled={busy || !previewReady || goLiveCountdown !== null}
                  className="w-full rounded-full bg-red-600 px-5 py-4 text-lg font-extrabold tracking-wide text-white disabled:opacity-50"
                >
                  {goLiveCountdown !== null ? `Demarrage dans ${goLiveCountdown}...` : busy ? "Demarrage..." : "Passer en live"}
                </button>
              ) : null}

              {showAdvancedMenu ? (
                <div className="grid gap-2 rounded-2xl border border-white/20 bg-black/55 p-3 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => void toggleCameraInput()}
                    className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white"
                  >
                    {cameraEnabled ? "Pause video" : "Reprendre video"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleMicrophoneInput()}
                    className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white"
                  >
                    {microphoneEnabled ? "Couper micro" : "Activer micro"}
                  </button>
                  <button
                    type="button"
                    onClick={openSellerStore}
                    className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white"
                  >
                    Acces boutique vendeur
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMenu(false)}
                    className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white/90"
                  >
                    Fermer menu
                  </button>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-2xl bg-black/45 px-3 py-2 backdrop-blur">
                <button type="button" className="flex flex-col items-center gap-1 text-white/95">
                  <Users size={21} />
                  <span className="text-[11px]">Utilisateurs</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-1 text-white/95">
                  <MessageSquare size={21} />
                  <span className="text-[11px]">Chat</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-1 text-white/95">
                  <Share2 size={21} />
                  <span className="text-[11px]">Partager</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBeautyPreview((prev) => !prev)}
                  className="flex flex-col items-center gap-1 text-white/95"
                >
                  <Sparkles size={21} />
                  <span className="text-[11px]">Effets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedMenu((prev) => !prev)}
                  className="flex flex-col items-center gap-1 text-white/95"
                >
                  <Ellipsis size={21} />
                  <span className="text-[11px]">Plus</span>
                </button>
              </div>

              <button
                type="button"
                onClick={closePreviewOverlay}
                disabled={busy || goLiveCountdown !== null}
                className="w-full rounded-full border border-white/30 bg-black/45 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isLive ? "Revenir au panneau studio" : "Fermer la previsualisation"}
              </button>
            </div>
          </div>

          {goLiveCountdown !== null ? (
            <div className="absolute inset-0 z-[98] grid place-items-center bg-black/50 backdrop-blur-[1px]">
              <div className="relative flex h-52 w-52 items-center justify-center rounded-full border-4 border-white/85 bg-gradient-to-b from-rose-500/90 to-red-700/90 text-8xl font-black text-white shadow-[0_0_60px_rgba(239,68,68,0.65)]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full border-4 border-white/35" />
                <span className="relative drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">{goLiveCountdown}</span>
              </div>
              <p className="absolute mt-72 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold tracking-wide text-white">
                Preparation du direct...
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
