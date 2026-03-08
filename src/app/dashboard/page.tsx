"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardStats } from "@/lib/types";

type ActivityEvent = {
  id: string;
  label: string;
  at: string;
  tone: "emerald" | "sky" | "amber" | "rose" | "slate";
};

type ThroughputPoint = {
  key: string;
  minuteLabel: string;
  likes: number;
  messages: number;
  gifts: number;
  followers: number;
  presence: number;
};

type AlertItem = {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  at: string;
};

type DashboardRole = "owner" | "admin" | "agent";

type TeamMember = {
  id: string;
  email: string | null;
  role: string | null;
};

type SellerPlanPricing = {
  jour: number;
  semaine: number;
  mois: number;
};

type SellerRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  storeName: string;
  phone: string;
  plan: "jour" | "semaine" | "mois";
  status: "pending" | "validated" | "refused";
  validatedBy?: string;
  certifiedBadge?: boolean;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
  lastModerationNote?: string;
};

type VisitorProfile = {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
  validatedBy?: string;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
  lastModerationNote?: string;
};

type DurationOption = {
  label: string;
  hours: number;
};

const ADMIN_AUTH_KEY = "pitchlive.admin.auth";
const DASHBOARD_SOUND_KEY = "pitchlive.admin.dashboard.sound";
const DASHBOARD_SOUND_MODE_KEY = "pitchlive.admin.dashboard.sound.mode";
const SELLER_PRICING_KEY = "pitchlive.seller.planPricing.v1";
const SELLER_REGISTRATIONS_KEY = "pitchlive.seller.registrations.v1";
const SELLER_REGISTRATION_KEY = "pitchlive.seller.registration";
const VISITOR_PROFILE_KEY = "pitchlive.viewer";
const MODERATION_DURATIONS: DurationOption[] = [
  { label: "1 jour", hours: 24 },
  { label: "3 jours", hours: 24 * 3 },
  { label: "7 jours", hours: 24 * 7 },
  { label: "30 jours", hours: 24 * 30 },
];
const DEFAULT_SELLER_PRICING: SellerPlanPricing = {
  jour: 5000,
  semaine: 25000,
  mois: 80000,
};
const EMPTY_STATS: DashboardStats = {
  activeLives: 0,
  totalLives: 0,
  totalMessages: 0,
  totalLikes: 0,
  totalGifts: 0,
  totalFollowers: 0,
  totalPresence: 0,
  totalSellerProfiles: 0,
  totalPushSubscriptions: 0,
};

const ROLE_FUNCTIONS: Record<DashboardRole, string[]> = {
  owner: ["Gestion equipe (roles)", "Dashboard complet", "Export analytics", "Validation vendeurs"],
  admin: ["Dashboard complet", "Validation vendeurs", "Export analytics", "Supervision live"],
  agent: ["Monitoring live", "Suivi chat", "Lecture analytics", "Support moderation"],
};

const ROLE_PARAMETER_BLOCKS: Array<{
  block: string;
  description: string;
  owner: boolean;
  admin: boolean;
  agent: boolean;
}> = [
  {
    block: "Bloc Live & Monitoring",
    description: "Studio, suivi flux realtime, supervision sessions live, alertes trafic",
    owner: true,
    admin: true,
    agent: true,
  },
  {
    block: "Bloc Moderation Vendeurs",
    description: "Validation, statut, certification, avertissement, ban temporaire/definitif",
    owner: true,
    admin: true,
    agent: false,
  },
  {
    block: "Bloc Moderation Visiteurs",
    description: "Validation infos, avertissement, ban temporaire/definitif, levee de ban",
    owner: true,
    admin: true,
    agent: true,
  },
  {
    block: "Bloc Equipe & Roles",
    description: "Attribution/retrait des roles, gestion des privileges d'acces dashboard",
    owner: true,
    admin: true,
    agent: false,
  },
  {
    block: "Bloc Tarification",
    description: "Gestion forfaits vendeur (jour/semaine/mois), mode 0 FCFA, reinitialisation",
    owner: true,
    admin: true,
    agent: false,
  },
  {
    block: "Bloc Export & Audit",
    description: "Export CSV analytics, lecture historique d'activite et alertes",
    owner: true,
    admin: true,
    agent: true,
  },
];

function formatRelativeDate(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const deltaSec = Math.max(1, Math.floor((now - target) / 1000));

  if (deltaSec < 60) return `${deltaSec}s`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m`;
  const deltaH = Math.floor(deltaMin / 60);
  if (deltaH < 24) return `${deltaH}h`;
  const deltaD = Math.floor(deltaH / 24);
  return `${deltaD}j`;
}

function toneClasses(tone: ActivityEvent["tone"]) {
  if (tone === "emerald") return "border-emerald-500/45 bg-emerald-900/15 text-emerald-100";
  if (tone === "sky") return "border-sky-500/45 bg-sky-900/15 text-sky-100";
  if (tone === "amber") return "border-amber-500/45 bg-amber-900/15 text-amber-100";
  if (tone === "rose") return "border-rose-500/45 bg-rose-900/15 text-rose-100";
  return "border-slate-600 bg-slate-800/50 text-slate-100";
}

function normalizeDashboardRole(value: string | null | undefined): DashboardRole | null {
  const role = (value ?? "").trim().toLowerCase();
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  return null;
}

function roleBadgeClasses(role: DashboardRole) {
  if (role === "owner") return "bg-red-600 text-white";
  if (role === "admin") return "bg-orange-500 text-white";
  return "bg-yellow-400 text-slate-950";
}

function normalizePlanPrice(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function formatCfa(value: number) {
  return `${Math.max(0, Math.floor(value)).toLocaleString("fr-FR")} F CFA`;
}

function isTempBanned(bannedUntil?: string | null) {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

function moderationLabel(input: { bannedPermanently?: boolean; bannedUntil?: string | null }) {
  if (input.bannedPermanently) return "BANNI DEFINITIF";
  if (isTempBanned(input.bannedUntil)) {
    return `BANNI TEMPORAIRE jusqu'au ${new Date(String(input.bannedUntil)).toLocaleString("fr-FR")}`;
  }
  return "AUCUN BAN";
}

function makeLast15MinSlots() {
  const now = new Date();
  now.setSeconds(0, 0);

  const slots: ThroughputPoint[] = [];
  for (let i = 14; i >= 0; i -= 1) {
    const minute = new Date(now.getTime() - i * 60_000);
    const y = minute.getFullYear();
    const m = `${minute.getMonth() + 1}`.padStart(2, "0");
    const d = `${minute.getDate()}`.padStart(2, "0");
    const hh = `${minute.getHours()}`.padStart(2, "0");
    const mm = `${minute.getMinutes()}`.padStart(2, "0");
    slots.push({
      key: `${y}-${m}-${d}T${hh}:${mm}`,
      minuteLabel: `${hh}:${mm}`,
      likes: 0,
      messages: 0,
      gifts: 0,
      followers: 0,
      presence: 0,
    });
  }

  return slots;
}

function minuteKeyFromIso(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function playBeep(
  audioContext: AudioContext,
  frequency: number,
  durationSec: number,
  startAt: number,
  gainValue: number
) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + durationSec);
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messageTimesRef = useRef<number[]>([]);
  const lastBurstAlertAtRef = useRef<number>(0);

  const [isAuthed, setIsAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [throughput, setThroughput] = useState<ThroughputPoint[]>(makeLast15MinSlots());
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundMode, setSoundMode] = useState<"all" | "night">("all");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dashboardRole, setDashboardRole] = useState<DashboardRole | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<string | null>(null);
  const [teamCanManage, setTeamCanManage] = useState(false);
  const [roleSavingUserId, setRoleSavingUserId] = useState<string | null>(null);
  const [quickAssignEmail, setQuickAssignEmail] = useState("");
  const [quickAssignRole, setQuickAssignRole] = useState<DashboardRole>("agent");
  const [quickAssignBusy, setQuickAssignBusy] = useState(false);
  const [pricingDraft, setPricingDraft] = useState<SellerPlanPricing>(DEFAULT_SELLER_PRICING);
  const [pricingInfo, setPricingInfo] = useState<string | null>(null);
  const [sellerRegistrations, setSellerRegistrations] = useState<SellerRegistration[]>([]);
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(null);
  const [moderationHours, setModerationHours] = useState<number>(24);
  const [moderationInfo, setModerationInfo] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(ADMIN_AUTH_KEY);
    setIsAuthed(existing === "1");

    const savedSound = window.localStorage.getItem(DASHBOARD_SOUND_KEY);
    if (savedSound === "0") {
      setSoundEnabled(false);
    }

    const savedMode = window.localStorage.getItem(DASHBOARD_SOUND_MODE_KEY);
    if (savedMode === "night") {
      setSoundMode("night");
    }

    const savedPricing = window.localStorage.getItem(SELLER_PRICING_KEY);
    if (savedPricing) {
      try {
        const parsed = JSON.parse(savedPricing) as Partial<SellerPlanPricing>;
        setPricingDraft({
          jour: Number.isFinite(parsed.jour) ? Math.max(0, Number(parsed.jour)) : DEFAULT_SELLER_PRICING.jour,
          semaine: Number.isFinite(parsed.semaine) ? Math.max(0, Number(parsed.semaine)) : DEFAULT_SELLER_PRICING.semaine,
          mois: Number.isFinite(parsed.mois) ? Math.max(0, Number(parsed.mois)) : DEFAULT_SELLER_PRICING.mois,
        });
      } catch {
        setPricingDraft(DEFAULT_SELLER_PRICING);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DASHBOARD_SOUND_KEY, soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DASHBOARD_SOUND_MODE_KEY, soundMode);
  }, [soundMode]);

  useEffect(() => {
    if (!isAuthed) {
      setDashboardRole(null);
      setTeamMembers([]);
      setTeamCanManage(false);
      setTeamError(null);
      setSellerRegistrations([]);
      setVisitorProfile(null);
      return;
    }

    void loadTeamMembers();
    loadModerationProfiles();
  }, [isAuthed]);

  const loadModerationProfiles = () => {
    if (typeof window === "undefined") return;

    const sellersRaw = window.localStorage.getItem(SELLER_REGISTRATIONS_KEY);
    const sellerRaw = window.localStorage.getItem(SELLER_REGISTRATION_KEY);

    let loadedSellers: SellerRegistration[] = [];
    if (sellersRaw) {
      try {
        const parsed = JSON.parse(sellersRaw) as SellerRegistration[];
        loadedSellers = Array.isArray(parsed) ? parsed.filter((item) => Boolean(item?.id)) : [];
      } catch {
        loadedSellers = [];
      }
    }

    if (!loadedSellers.length && sellerRaw) {
      try {
        const single = JSON.parse(sellerRaw) as SellerRegistration;
        if (single?.id) {
          loadedSellers = [single];
        }
      } catch {
        loadedSellers = [];
      }
    }

    setSellerRegistrations(loadedSellers);

    const visitorRaw = window.localStorage.getItem(VISITOR_PROFILE_KEY);
    if (!visitorRaw) {
      setVisitorProfile(null);
    } else {
      try {
        setVisitorProfile(JSON.parse(visitorRaw) as VisitorProfile);
      } catch {
        setVisitorProfile(null);
      }
    }
  };

  const saveSellerModeration = (next: SellerRegistration) => {
    setSellerRegistrations((prev) => {
      const found = prev.some((item) => item.id === next.id);
      const updated = found ? prev.map((item) => (item.id === next.id ? next : item)) : [next, ...prev];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SELLER_REGISTRATIONS_KEY, JSON.stringify(updated));
      }
      return updated;
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELLER_REGISTRATION_KEY, JSON.stringify(next));
    }
  };

  const saveVisitorModeration = (next: VisitorProfile) => {
    setVisitorProfile(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(next));
    }
  };

  const moderationUntilIso = () => new Date(Date.now() + moderationHours * 60 * 60 * 1000).toISOString();

  const verifyPin = async () => {
    setAuthError(null);
    if (!pin.trim()) {
      setAuthError("Entre le code PIN admin.");
      return;
    }

    setAuthBusy(true);
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "PIN invalide");
      }

      window.sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
      setIsAuthed(true);
      setPin("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PIN invalide";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutAdmin = () => {
    window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAuthed(false);
    setRealtimeConnected(false);
  };

  const loadTeamMembers = async () => {
    setTeamBusy(true);
    setTeamError(null);
    setTeamInfo(null);
    try {
      const res = await fetch("/api/dashboard/team", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        team?: TeamMember[];
        callerRole?: DashboardRole;
        canManage?: boolean;
      };

      if (!res.ok || !body.ok) {
        throw new Error(body.error || "Impossible de charger l'equipe.");
      }

      setDashboardRole(body.callerRole ?? null);
      setTeamMembers(body.team ?? []);
      setTeamCanManage(Boolean(body.canManage));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger l'equipe.";
      setTeamError(message);
      setTeamMembers([]);
      setTeamCanManage(false);
    } finally {
      setTeamBusy(false);
    }
  };

  const assignUserRole = async (userId: string, role: DashboardRole | null) => {
    if (!teamCanManage) return;

    setRoleSavingUserId(userId);
    setTeamError(null);
    setTeamInfo(null);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.error || "Mise a jour role impossible.");
      }

      await loadTeamMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mise a jour role impossible.";
      setTeamError(message);
    } finally {
      setRoleSavingUserId(null);
    }
  };

  const assignRoleByEmail = async () => {
    if (!teamCanManage || !quickAssignEmail.trim()) return;

    setQuickAssignBusy(true);
    setTeamError(null);
    setTeamInfo(null);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: quickAssignEmail.trim(), role: quickAssignRole }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.error || "Attribution du role impossible.");
      }

      setTeamInfo(`Role ${quickAssignRole.toUpperCase()} attribue a ${quickAssignEmail.trim()}.`);
      setQuickAssignEmail("");
      await loadTeamMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attribution du role impossible.";
      setTeamError(message);
    } finally {
      setQuickAssignBusy(false);
    }
  };

  const getSellerById = (sellerId: string) => sellerRegistrations.find((item) => item.id === sellerId) ?? null;

  const certifySeller = (sellerId: string) => {
    const seller = getSellerById(sellerId);
    if (!seller) return;
    saveSellerModeration({
      ...seller,
      certifiedBadge: true,
      lastModerationNote: "Badge certifie active",
    });
    setModerationInfo(`Vendeur ${seller.storeName}: certification activee.`);
  };

  const setSellerStatus = (sellerId: string, status: SellerRegistration["status"]) => {
    const seller = getSellerById(sellerId);
    if (!seller) return;
    saveSellerModeration({
      ...seller,
      status,
      certifiedBadge: status === "validated" ? true : seller.certifiedBadge,
      validatedBy: status === "validated" ? "admin" : seller.validatedBy,
      lastModerationNote: `Statut modifie en ${status}`,
    });
    setModerationInfo(`Vendeur ${seller.storeName}: statut ${status} applique.`);
  };

  const warnSeller = (sellerId: string) => {
    const seller = getSellerById(sellerId);
    if (!seller) return;
    saveSellerModeration({
      ...seller,
      warningCount: (seller.warningCount ?? 0) + 1,
      lastModerationNote: "Avertissement admin envoye",
    });
    setModerationInfo(`Vendeur ${seller.storeName}: avertissement ajoute.`);
  };

  const banSellerTemporary = (sellerId: string) => {
    const seller = getSellerById(sellerId);
    if (!seller) return;
    saveSellerModeration({
      ...seller,
      bannedUntil: moderationUntilIso(),
      bannedPermanently: false,
      lastModerationNote: `Ban temporaire ${moderationHours}h`,
    });
    setModerationInfo(`Vendeur ${seller.storeName}: ban temporaire ${moderationHours}h applique.`);
  };

  const banSellerPermanent = (sellerId: string) => {
    const seller = getSellerById(sellerId);
    if (!seller) return;
    saveSellerModeration({
      ...seller,
      status: "refused",
      bannedPermanently: true,
      bannedUntil: null,
      lastModerationNote: "Ban definitif",
    });
    setModerationInfo(`Vendeur ${seller.storeName}: ban definitif applique.`);
  };

  const clearSellerBan = (sellerId: string) => {
    const seller = getSellerById(sellerId);
    if (!seller) return;
    saveSellerModeration({
      ...seller,
      bannedPermanently: false,
      bannedUntil: null,
      lastModerationNote: "Ban leve",
    });
    setModerationInfo(`Vendeur ${seller.storeName}: ban leve.`);
  };

  const validateVisitorInfos = () => {
    if (!visitorProfile) return;
    saveVisitorModeration({
      ...visitorProfile,
      status: "validated",
      validatedBy: "admin",
      lastModerationNote: "Informations visiteur validees",
    });
    setModerationInfo("Visiteur: informations validees.");
  };

  const warnVisitor = () => {
    if (!visitorProfile) return;
    saveVisitorModeration({
      ...visitorProfile,
      warningCount: (visitorProfile.warningCount ?? 0) + 1,
      lastModerationNote: "Avertissement admin envoye",
    });
    setModerationInfo("Visiteur: avertissement ajoute.");
  };

  const banVisitorTemporary = () => {
    if (!visitorProfile) return;
    saveVisitorModeration({
      ...visitorProfile,
      bannedUntil: moderationUntilIso(),
      bannedPermanently: false,
      lastModerationNote: `Ban temporaire ${moderationHours}h`,
    });
    setModerationInfo(`Visiteur: ban temporaire ${moderationHours}h applique.`);
  };

  const banVisitorPermanent = () => {
    if (!visitorProfile) return;
    saveVisitorModeration({
      ...visitorProfile,
      bannedPermanently: true,
      bannedUntil: null,
      lastModerationNote: "Ban definitif",
    });
    setModerationInfo("Visiteur: ban definitif applique.");
  };

  const clearVisitorBan = () => {
    if (!visitorProfile) return;
    saveVisitorModeration({
      ...visitorProfile,
      bannedPermanently: false,
      bannedUntil: null,
      lastModerationNote: "Ban leve",
    });
    setModerationInfo("Visiteur: ban leve.");
  };

  const saveSellerPricing = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SELLER_PRICING_KEY, JSON.stringify(pricingDraft));
    setPricingInfo("Tarifs forfaits sauvegardes.");
    window.setTimeout(() => setPricingInfo(null), 2200);
  };

  const resetSellerPricingDefaults = () => {
    setPricingDraft(DEFAULT_SELLER_PRICING);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELLER_PRICING_KEY, JSON.stringify(DEFAULT_SELLER_PRICING));
    }
    setPricingInfo("Tarifs forfaits reinitialises (5000 / 25000 / 80000).");
    window.setTimeout(() => setPricingInfo(null), 2200);
  };

  const ensureAudioContext = async () => {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return null;
      audioContextRef.current = new Context();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const playAlertSound = async (severity: AlertItem["severity"]) => {
    if (!soundEnabled) return;
    if (soundMode === "night" && severity !== "critical") return;

    const ctx = await ensureAudioContext();
    if (!ctx) return;

    const t0 = ctx.currentTime + 0.01;
    if (severity === "critical") {
      playBeep(ctx, 880, 0.14, t0, 0.08);
      playBeep(ctx, 740, 0.14, t0 + 0.18, 0.08);
      playBeep(ctx, 980, 0.18, t0 + 0.36, 0.09);
      return;
    }

    if (severity === "warning") {
      playBeep(ctx, 700, 0.11, t0, 0.065);
      playBeep(ctx, 620, 0.11, t0 + 0.15, 0.065);
      return;
    }

    playBeep(ctx, 560, 0.1, t0, 0.05);
  };

  const pushAlert = (message: string, severity: AlertItem["severity"], withSound = true) => {
    const alert: AlertItem = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      severity,
      at: new Date().toISOString(),
    };

    setAlerts((prev) => [alert, ...prev].slice(0, 40));

    if (withSound) {
      void playAlertSound(severity).catch(() => undefined);
    }
  };

  const testSound = () => {
    pushAlert("Test audio equipe", "critical", true);
  };

  useEffect(() => {
    if (!isAuthed) return;

    let mounted = true;

    const safeCount = async (
      table: string,
      filter?: { col: string; value: string | boolean }
    ) => {
      try {
        let query = supabase.from(table).select("id", { count: "exact", head: true });
        if (filter) {
          query = query.eq(filter.col, filter.value);
        }
        const { count } = await query;
        return count ?? 0;
      } catch {
        return 0;
      }
    };

    const loadDashboard = async () => {
      const windowStartIso = new Date(Date.now() - 15 * 60_000).toISOString();

      const [
        activeLives,
        totalLives,
        totalMessages,
        totalLikes,
        totalGifts,
        totalFollowers,
        totalPresence,
        totalSellerProfiles,
        totalPushSubscriptions,
      ] = await Promise.all([
        safeCount("live_sessions", { col: "status", value: "live" }),
        safeCount("live_sessions"),
        safeCount("messages"),
        safeCount("likes"),
        safeCount("gifts"),
        safeCount("followers"),
        safeCount("live_presence"),
        safeCount("seller_store_profiles"),
        safeCount("push_subscriptions", { col: "enabled", value: true }),
      ]);

      const [sessionsRecent, messagesRecent, likesRecent, giftsRecent, followersRecent, presenceRecent] = await Promise.all([
        supabase
          .from("live_sessions")
          .select("id,title,status,creator_id,started_at,ended_at")
          .order("started_at", { ascending: false })
          .limit(12),
        supabase
          .from("messages")
          .select("id,username,content,created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("likes")
          .select("id,user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(16),
        supabase
          .from("gifts")
          .select("id,username,gift_type,created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("followers")
          .select("creator_id,follower_id,created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("live_presence")
          .select("id,user_id,joined_at")
          .order("joined_at", { ascending: false })
          .limit(12),
      ]);

      const [likesWindow, messagesWindow, giftsWindow, followersWindow, presenceWindow] = await Promise.all([
        supabase.from("likes").select("created_at").gte("created_at", windowStartIso).limit(500),
        supabase.from("messages").select("created_at").gte("created_at", windowStartIso).limit(500),
        supabase.from("gifts").select("created_at").gte("created_at", windowStartIso).limit(500),
        supabase.from("followers").select("created_at").gte("created_at", windowStartIso).limit(500),
        supabase.from("live_presence").select("joined_at").gte("joined_at", windowStartIso).limit(500),
      ]);

      if (!mounted) return;

      setStats({
        activeLives,
        totalLives,
        totalMessages,
        totalLikes,
        totalGifts,
        totalFollowers,
        totalPresence,
        totalSellerProfiles,
        totalPushSubscriptions,
      });

      const events: ActivityEvent[] = [];

      (sessionsRecent.data ?? []).forEach((row) => {
        const title = String(row.title ?? "Live");
        const status = String(row.status ?? "live");
        const when = status === "ended" ? String(row.ended_at ?? row.started_at ?? "") : String(row.started_at ?? "");
        if (!when) return;
        events.push({
          id: `live-${row.id}-${status}-${when}`,
          label: status === "ended" ? `Live termine: ${title}` : `Live demarre: ${title}`,
          at: when,
          tone: status === "ended" ? "slate" : "emerald",
        });
      });

      (messagesRecent.data ?? []).forEach((row) => {
        if (!row.created_at) return;
        const user = String(row.username ?? "visiteur");
        const content = String(row.content ?? "").slice(0, 46);
        events.push({
          id: `msg-${row.id}`,
          label: `Message ${user}: ${content}`,
          at: String(row.created_at),
          tone: "sky",
        });
      });

      (likesRecent.data ?? []).forEach((row) => {
        if (!row.created_at) return;
        events.push({
          id: `like-${row.id}`,
          label: `Nouveau coeur de ${String(row.user_id ?? "visiteur")}`,
          at: String(row.created_at),
          tone: "rose",
        });
      });

      (giftsRecent.data ?? []).forEach((row) => {
        if (!row.created_at) return;
        events.push({
          id: `gift-${row.id}`,
          label: `Cadeau ${String(row.gift_type ?? "gift")} de ${String(row.username ?? "visiteur")}`,
          at: String(row.created_at),
          tone: "amber",
        });
      });

      (followersRecent.data ?? []).forEach((row) => {
        if (!row.created_at) return;
        events.push({
          id: `follow-${String(row.creator_id)}-${String(row.follower_id)}-${String(row.created_at)}`,
          label: `Nouveau follower ${String(row.follower_id ?? "-")} -> ${String(row.creator_id ?? "-")}`,
          at: String(row.created_at),
          tone: "emerald",
        });
      });

      (presenceRecent.data ?? []).forEach((row) => {
        if (!row.joined_at) return;
        events.push({
          id: `presence-${String(row.id)}`,
          label: `Entree live de ${String(row.user_id ?? "visiteur")}`,
          at: String(row.joined_at),
          tone: "slate",
        });
      });

      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setActivityEvents(events.slice(0, 40));

      const slots = makeLast15MinSlots();
      const slotMap = new Map(slots.map((slot) => [slot.key, slot]));

      (likesWindow.data ?? []).forEach((row) => {
        const key = minuteKeyFromIso(String(row.created_at));
        const slot = slotMap.get(key);
        if (slot) slot.likes += 1;
      });
      (messagesWindow.data ?? []).forEach((row) => {
        const key = minuteKeyFromIso(String(row.created_at));
        const slot = slotMap.get(key);
        if (slot) slot.messages += 1;
      });
      (giftsWindow.data ?? []).forEach((row) => {
        const key = minuteKeyFromIso(String(row.created_at));
        const slot = slotMap.get(key);
        if (slot) slot.gifts += 1;
      });
      (followersWindow.data ?? []).forEach((row) => {
        const key = minuteKeyFromIso(String(row.created_at));
        const slot = slotMap.get(key);
        if (slot) slot.followers += 1;
      });
      (presenceWindow.data ?? []).forEach((row) => {
        const key = minuteKeyFromIso(String(row.joined_at));
        const slot = slotMap.get(key);
        if (slot) slot.presence += 1;
      });

      setThroughput(slots);
      setLastRefreshAt(new Date().toISOString());
    };

    void loadDashboard();

    const scheduleReload = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        void loadDashboard();
      }, 220);
    };

    const onLiveSessionEvent = (payload: { eventType: string; new: Record<string, unknown> }) => {
      scheduleReload();

      if (payload.eventType !== "INSERT") return;
      const status = String(payload.new.status ?? "");
      if (status !== "live") return;
      const title = String(payload.new.title ?? "Live");
      pushAlert(`Nouveau live demarre: ${title}`, "critical", true);
    };

    const onMessageEvent = (payload: { eventType: string; new: Record<string, unknown> }) => {
      scheduleReload();
      if (payload.eventType !== "INSERT") return;

      const now = Date.now();
      messageTimesRef.current = [...messageTimesRef.current.filter((ts) => now - ts < 60_000), now];

      const countLastMinute = messageTimesRef.current.length;
      if (countLastMinute >= 25 && now - lastBurstAlertAtRef.current > 45_000) {
        lastBurstAlertAtRef.current = now;
        pushAlert(`Alerte pic chat: ${countLastMinute} messages/min`, "warning", true);
      }
    };

    const onGiftEvent = (payload: { eventType: string; new: Record<string, unknown> }) => {
      scheduleReload();
      if (payload.eventType !== "INSERT") return;
      const gift = String(payload.new.gift_type ?? "cadeau");
      const user = String(payload.new.username ?? "visiteur");
      pushAlert(`Nouveau cadeau ${gift} de ${user}`, "info", false);
    };

    const onFollowerEvent = (payload: { eventType: string; new: Record<string, unknown> }) => {
      scheduleReload();
      if (payload.eventType !== "INSERT") return;
      const creator = String(payload.new.creator_id ?? "vendeur");
      pushAlert(`Nouveau follower pour ${creator}`, "info", false);
    };

    const channel = supabase
      .channel("admin-dashboard-realtime-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, onLiveSessionEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onMessageEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "gifts" }, onGiftEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, onFollowerEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_presence" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_store_profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "push_subscriptions" }, scheduleReload)
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      mounted = false;
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [isAuthed, supabase]);

  const maxPerMinute = useMemo(() => {
    const values = throughput.map((point) => point.likes + point.messages + point.gifts + point.followers + point.presence);
    return Math.max(1, ...values);
  }, [throughput]);

  if (loading) {
    return <main className="min-h-screen bg-slate-950 text-slate-50 grid place-items-center">Chargement dashboard...</main>;
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
        <section className="mx-auto max-w-md grid gap-5">
          <h1 className="text-3xl font-black">Dashboard Admin</h1>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p className="text-sm text-slate-300">Entrez le PIN admin pour ouvrir le tableau de bord temps reel.</p>
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="PIN admin"
            />
            <button
              type="button"
              onClick={() => void verifyPin()}
              disabled={authBusy}
              className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
            >
              {authBusy ? "Verification..." : "Acceder"}
            </button>
            {authError ? <p className="text-sm text-rose-300">Erreur: {authError}</p> : null}
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <section className="mx-auto max-w-7xl grid gap-4">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <img
                src="https://www.pitchci.com/icons/preview-logo-v2.svg"
                alt="Pitch Live"
                className="h-11 w-11 rounded-xl border border-slate-600 bg-slate-800 p-1"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Dashboard Administrateur Temps Reel</h1>
                {dashboardRole ? (
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ${roleBadgeClasses(dashboardRole)}`}>
                    {dashboardRole === "owner" ? "Proprietaire" : dashboardRole === "admin" ? "Admin" : "Agent"}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className={`rounded-full px-4 py-2 font-semibold ${
                  soundEnabled ? "bg-emerald-700" : "bg-slate-700"
                }`}
              >
                {soundEnabled ? "Son alertes: ON" : "Son alertes: OFF"}
              </button>
              <button
                type="button"
                onClick={() => setSoundMode((prev) => (prev === "all" ? "night" : "all"))}
                className={`rounded-full px-4 py-2 font-semibold ${
                  soundMode === "night" ? "bg-indigo-700" : "bg-slate-700"
                }`}
              >
                {soundMode === "night" ? "Mode nuit: critiques" : "Mode son: tous"}
              </button>
              <button
                type="button"
                onClick={testSound}
                className="rounded-full bg-amber-700 px-4 py-2 font-semibold"
              >
                Tester son
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-slate-700 px-4 py-2 font-semibold"
              >
                Rafraichir
              </button>
              <button type="button" onClick={logoutAdmin} className="rounded-full bg-rose-700 px-4 py-2 font-semibold">
                Deconnexion admin
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
                realtimeConnected ? "border-emerald-400/70 bg-emerald-900/25 text-emerald-200" : "border-amber-400/70 bg-amber-900/25 text-amber-200"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${realtimeConnected ? "bg-emerald-300" : "bg-amber-300"}`} />
              {realtimeConnected ? "Flux realtime connecte" : "Flux realtime en reconnexion"}
            </span>
            <span>Derniere sync: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString("fr-FR") : "--:--:--"}</span>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Centre d'alertes equipe</p>
              <span className="text-xs text-slate-400">{alerts.length} alertes recentes</span>
            </div>
            <div className="max-h-28 overflow-y-auto grid gap-1">
              {alerts.length ? (
                alerts.slice(0, 8).map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      alert.severity === "critical"
                        ? "border-rose-500/60 bg-rose-900/20 text-rose-100"
                        : alert.severity === "warning"
                          ? "border-amber-500/60 bg-amber-900/20 text-amber-100"
                          : "border-sky-500/60 bg-sky-900/20 text-sky-100"
                    }`}
                  >
                    <p>{alert.message}</p>
                    <p className="opacity-80">{formatRelativeDate(alert.at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Aucune alerte pour le moment.</p>
              )}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Lives actifs" value={stats.activeLives} tone="emerald" />
          <StatCard label="Lives total" value={stats.totalLives} tone="slate" />
          <StatCard label="Messages" value={stats.totalMessages} tone="sky" />
          <StatCard label="Coeurs" value={stats.totalLikes} tone="rose" />
          <StatCard label="Cadeaux" value={stats.totalGifts} tone="amber" />
          <StatCard label="Followers" value={stats.totalFollowers} tone="emerald" />
          <StatCard label="Presences live" value={stats.totalPresence} tone="slate" />
          <StatCard label="Boutiques" value={stats.totalSellerProfiles} tone="sky" />
          <StatCard label="Push abonnes" value={stats.totalPushSubscriptions} tone="amber" />
        </section>

        <section className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
            <h2 className="font-semibold text-slate-100">Analytique temps reel (15 dernieres minutes)</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
              <Legend label="Coeurs" color="bg-rose-400" />
              <Legend label="Messages" color="bg-sky-400" />
              <Legend label="Cadeaux" color="bg-amber-400" />
              <Legend label="Followers" color="bg-emerald-400" />
              <Legend label="Entrees live" color="bg-slate-300" />
            </div>

            <div className="h-56 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div className="h-full w-full flex items-end gap-1 overflow-x-auto">
                {throughput.map((point) => {
                  const total = point.likes + point.messages + point.gifts + point.followers + point.presence;
                  const normalized = (total / maxPerMinute) * 100;
                  return (
                    <div key={point.key} className="min-w-7 h-full flex flex-col justify-end items-center gap-1">
                      <div className="w-6 h-[88%] rounded-md bg-slate-800 border border-slate-700 relative overflow-hidden">
                        <StackSlice color="bg-rose-500" value={point.likes} total={maxPerMinute} />
                        <StackSlice color="bg-sky-500" value={point.messages} total={maxPerMinute} />
                        <StackSlice color="bg-amber-500" value={point.gifts} total={maxPerMinute} />
                        <StackSlice color="bg-emerald-500" value={point.followers} total={maxPerMinute} />
                        <StackSlice color="bg-slate-200" value={point.presence} total={maxPerMinute} />
                        <div
                          className="absolute left-0 right-0 bottom-0 bg-white/5"
                          style={{ height: `${Math.max(2, normalized)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{point.minuteLabel.slice(-2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3">
            <h2 className="font-semibold text-slate-100">Activite en direct</h2>
            <div className="max-h-72 overflow-y-auto grid gap-2 pr-1">
              {activityEvents.length ? (
                activityEvents.map((event) => (
                  <div key={event.id} className={`rounded-xl border px-3 py-2 text-sm ${toneClasses(event.tone)}`}>
                    <p className="leading-snug">{event.label}</p>
                    <p className="text-[11px] opacity-80 mt-1">{formatRelativeDate(event.at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Aucune activite recente.</p>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-slate-100">Gestion vendeurs et visiteurs</h2>
            <button
              type="button"
              onClick={loadModerationProfiles}
              className="rounded-full bg-slate-700 px-3 py-2 text-xs font-semibold"
            >
              Rafraichir moderation
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm text-slate-300">Duree ban temporaire:</label>
            <select
              value={String(moderationHours)}
              onChange={(event) => setModerationHours(Number(event.target.value))}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm outline-none"
            >
              {MODERATION_DURATIONS.map((item) => (
                <option key={item.hours} value={item.hours}>{item.label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400">Applique au vendeur et au visiteur</span>
          </div>

          {moderationInfo ? <p className="text-sm text-emerald-300">{moderationInfo}</p> : null}

          <div className="grid lg:grid-cols-2 gap-4">
            <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 grid gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-100">Section gestion vendeurs</h3>
                <Link href="/admin/vendeurs" className="rounded-full bg-sky-700 px-3 py-1.5 text-xs font-semibold">
                  Ouvrir page complete
                </Link>
              </div>

              {!sellerRegistrations.length ? (
                <p className="text-sm text-slate-400">Aucune demande vendeur locale detectee.</p>
              ) : (
                <div className="grid gap-3 max-h-96 overflow-y-auto pr-1">
                  {sellerRegistrations.map((seller) => (
                    <article key={seller.id} className="rounded-xl border border-slate-700 bg-slate-900/75 p-3 grid gap-2">
                      <p className="text-sm">
                        <strong>{seller.firstName} {seller.lastName}</strong> • {seller.storeName}
                      </p>
                      <div className="flex gap-2 flex-wrap text-xs">
                        <span className="rounded-full bg-slate-700 px-2 py-1">Statut: {seller.status.toUpperCase()}</span>
                        <span className={`rounded-full px-2 py-1 ${seller.certifiedBadge ? "bg-sky-700" : "bg-slate-700"}`}>
                          {seller.certifiedBadge ? "Certifie" : "Non certifie"}
                        </span>
                        <span className="rounded-full bg-slate-700 px-2 py-1">Avertissements: {seller.warningCount ?? 0}</span>
                      </div>
                      <p className="text-xs text-slate-300">Ban: {moderationLabel(seller)}</p>
                      {seller.lastModerationNote ? <p className="text-xs text-slate-400">Derniere action: {seller.lastModerationNote}</p> : null}

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => certifySeller(seller.id)} className="rounded-full bg-sky-700 px-3 py-2 text-xs font-semibold">
                          Certifier
                        </button>
                        <button type="button" onClick={() => setSellerStatus(seller.id, "validated")} className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold">
                          Valide
                        </button>
                        <button type="button" onClick={() => setSellerStatus(seller.id, "pending")} className="rounded-full bg-amber-700 px-3 py-2 text-xs font-semibold">
                          En attente
                        </button>
                        <button type="button" onClick={() => warnSeller(seller.id)} className="rounded-full bg-orange-600 px-3 py-2 text-xs font-semibold">
                          Avertissement
                        </button>
                        <button type="button" onClick={() => banSellerTemporary(seller.id)} className="rounded-full bg-rose-700 px-3 py-2 text-xs font-semibold">
                          Bani
                        </button>
                        <button type="button" onClick={() => banSellerPermanent(seller.id)} className="rounded-full bg-red-700 px-3 py-2 text-xs font-semibold">
                          Bani definitif
                        </button>
                        <button type="button" onClick={() => clearSellerBan(seller.id)} className="rounded-full bg-cyan-700 px-3 py-2 text-xs font-semibold">
                          Lever ban
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 grid gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-100">Section gestion visiteurs</h3>
                <Link href="/mur" className="rounded-full bg-sky-700 px-3 py-1.5 text-xs font-semibold">
                  Ouvrir mur visiteur
                </Link>
              </div>

              {!visitorProfile ? (
                <p className="text-sm text-slate-400">Aucun profil visiteur local detecte.</p>
              ) : (
                <>
                  <p className="text-sm">Visiteur: <strong>{visitorProfile.username}</strong></p>
                  <p className="text-sm">Telephone: <strong>{visitorProfile.phone || "--"}</strong></p>
                  <p className="text-sm">Statut infos: <strong>{(visitorProfile.status || "pending").toUpperCase()}</strong></p>
                  <p className="text-sm">Avertissements: <strong>{visitorProfile.warningCount ?? 0}</strong></p>
                  <p className="text-sm">Ban: <strong>{moderationLabel(visitorProfile)}</strong></p>
                  {visitorProfile.lastModerationNote ? (
                    <p className="text-xs text-slate-400">Derniere action: {visitorProfile.lastModerationNote}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={validateVisitorInfos} className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold">
                      Valider infos
                    </button>
                    <button type="button" onClick={warnVisitor} className="rounded-full bg-orange-600 px-3 py-2 text-xs font-semibold">
                      Avertissement
                    </button>
                    <button type="button" onClick={banVisitorTemporary} className="rounded-full bg-rose-700 px-3 py-2 text-xs font-semibold">
                      Ban temporaire
                    </button>
                    <button type="button" onClick={banVisitorPermanent} className="rounded-full bg-red-700 px-3 py-2 text-xs font-semibold">
                      Ban definitif
                    </button>
                    <button type="button" onClick={clearVisitorBan} className="rounded-full bg-cyan-700 px-3 py-2 text-xs font-semibold">
                      Lever ban
                    </button>
                  </div>
                </>
              )}
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-slate-100">Gestion equipe (roles + fonctions)</h2>
            <button
              type="button"
              onClick={() => void loadTeamMembers()}
              disabled={teamBusy}
              className="rounded-full bg-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {teamBusy ? "Chargement..." : "Rafraichir equipe"}
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-red-500/50 bg-red-900/20 p-3">
              <p className="font-bold text-red-200">Proprietaire (Rouge)</p>
              <p className="mt-1 text-red-100/90">{ROLE_FUNCTIONS.owner.join(" • ")}</p>
            </div>
            <div className="rounded-xl border border-orange-500/50 bg-orange-900/20 p-3">
              <p className="font-bold text-orange-200">Admin (Orange)</p>
              <p className="mt-1 text-orange-100/90">{ROLE_FUNCTIONS.admin.join(" • ")}</p>
            </div>
            <div className="rounded-xl border border-yellow-500/60 bg-yellow-900/20 p-3">
              <p className="font-bold text-yellow-200">Agent (Jaune)</p>
              <p className="mt-1 text-yellow-100/90">{ROLE_FUNCTIONS.agent.join(" • ")}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 grid gap-3">
            <p className="text-sm font-semibold text-slate-100">Attribution des roles par bloc de parametres</p>
            <div className="grid gap-2">
              {ROLE_PARAMETER_BLOCKS.map((item) => (
                <article key={item.block} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 grid gap-2">
                  <p className="text-sm font-semibold text-slate-100">{item.block}</p>
                  <p className="text-xs text-slate-300">{item.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${item.owner ? "bg-red-600 text-white" : "bg-slate-700 text-slate-300"}`}>
                      Owner {item.owner ? "autorise" : "non"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${item.admin ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                      Admin {item.admin ? "autorise" : "non"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${item.agent ? "bg-yellow-400 text-slate-950" : "bg-slate-700 text-slate-300"}`}>
                      Agent {item.agent ? "autorise" : "non"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {teamError ? <p className="text-sm text-rose-300">Erreur equipe: {teamError}</p> : null}
          {teamInfo ? <p className="text-sm text-emerald-300">{teamInfo}</p> : null}
          {!teamCanManage ? (
            <p className="text-sm text-slate-300">
              Ton role peut consulter le dashboard, mais la gestion des roles est reservee au proprietaire/admin.
            </p>
          ) : null}

          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 grid gap-3">
            <p className="text-sm font-semibold text-slate-100">Creer / attribuer un role par email</p>
            <div className="grid md:grid-cols-[1fr_auto_auto] gap-2">
              <input
                type="email"
                value={quickAssignEmail}
                onChange={(event) => setQuickAssignEmail(event.target.value)}
                placeholder="email@exemple.com"
                className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none"
              />
              <select
                value={quickAssignRole}
                onChange={(event) => setQuickAssignRole(event.target.value as DashboardRole)}
                className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none"
              >
                <option value="owner">Proprietaire</option>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
              </select>
              <button
                type="button"
                disabled={!teamCanManage || quickAssignBusy || !quickAssignEmail.trim()}
                onClick={() => void assignRoleByEmail()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {quickAssignBusy ? "Attribution..." : "Creer role"}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Ce bouton affecte un role a un compte existant via son email (et cree la fiche role si besoin).
            </p>
          </div>

          <div className="grid gap-2 max-h-96 overflow-y-auto pr-1">
            {teamMembers.length ? (
              teamMembers.map((member) => {
                const rowRole = normalizeDashboardRole(member.role);
                return (
                  <div key={member.id} className="rounded-xl border border-slate-700 bg-slate-800/65 p-3 grid gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{member.email || member.id}</p>
                        <p className="text-[11px] text-slate-400">ID: {member.id}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          rowRole ? roleBadgeClasses(rowRole) : "bg-slate-600 text-white"
                        }`}
                      >
                        {rowRole === "owner" ? "Proprietaire" : rowRole === "admin" ? "Admin" : rowRole === "agent" ? "Agent" : "Aucun role"}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={!teamCanManage || roleSavingUserId === member.id}
                        onClick={() => void assignUserRole(member.id, "owner")}
                        className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Proprietaire
                      </button>
                      <button
                        type="button"
                        disabled={!teamCanManage || roleSavingUserId === member.id}
                        onClick={() => void assignUserRole(member.id, "admin")}
                        className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        disabled={!teamCanManage || roleSavingUserId === member.id}
                        onClick={() => void assignUserRole(member.id, "agent")}
                        className="rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
                      >
                        Agent
                      </button>
                      <button
                        type="button"
                        disabled={!teamCanManage || roleSavingUserId === member.id}
                        onClick={() => void assignUserRole(member.id, null)}
                        className="rounded-full bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Retirer role
                      </button>
                    </div>

                    {rowRole ? (
                      <p className="text-[11px] text-slate-300">Fonctions attribuees: {ROLE_FUNCTIONS[rowRole].join(" • ")}</p>
                    ) : (
                      <p className="text-[11px] text-slate-400">Aucune fonction dashboard attribuee.</p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">Aucun utilisateur charge pour le moment.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-slate-100">Gestion des forfaits vendeurs</h2>
            <p className="text-xs text-slate-400">Tarifs libres de 0 F CFA a l'infini</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="grid gap-1 text-sm">
              Forfait JOUR (F CFA)
              <input
                inputMode="numeric"
                value={String(pricingDraft.jour)}
                onChange={(event) =>
                  setPricingDraft((prev) => ({
                    ...prev,
                    jour: normalizePlanPrice(event.target.value),
                  }))
                }
                className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Forfait SEMAINE (F CFA)
              <input
                inputMode="numeric"
                value={String(pricingDraft.semaine)}
                onChange={(event) =>
                  setPricingDraft((prev) => ({
                    ...prev,
                    semaine: normalizePlanPrice(event.target.value),
                  }))
                }
                className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Forfait MOIS (F CFA)
              <input
                inputMode="numeric"
                value={String(pricingDraft.mois)}
                onChange={(event) =>
                  setPricingDraft((prev) => ({
                    ...prev,
                    mois: normalizePlanPrice(event.target.value),
                  }))
                }
                className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              />
            </label>
          </div>

          <div className="text-xs text-slate-300 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            Apercu vendeur actuel: JOUR {formatCfa(pricingDraft.jour)} • SEMAINE {formatCfa(pricingDraft.semaine)} • MOIS {formatCfa(pricingDraft.mois)}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveSellerPricing} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold">
              Sauvegarder tarifs
            </button>
            <button
              type="button"
              onClick={() => setPricingDraft({ jour: 0, semaine: 0, mois: 0 })}
              className="rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold"
            >
              Tout gratuit (0 FCFA)
            </button>
            <button type="button" onClick={resetSellerPricingDefaults} className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold">
              Reinitialiser par defaut
            </button>
          </div>

          {pricingInfo ? <p className="text-sm text-emerald-300">{pricingInfo}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3">
          <h2 className="font-semibold text-slate-100">Controle complet de l'application</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <Link href="/watch" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Live Watch</Link>
            <Link href="/creator/studio" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Studio vendeur</Link>
            <Link href="/creator/settings" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Settings vendeur</Link>
            <Link href="/admin/vendeurs" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Validation vendeurs</Link>
            <Link href="/mur" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Mur visiteur</Link>
            <Link href="/boutique" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Boutiques</Link>
            <Link href="/vendeur/inscription" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Inscription vendeur</Link>
            <Link href="/visiteur/inscription" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">Inscription visiteur</Link>
          </div>
          <a href="/api/dashboard/export" className="inline-flex w-fit rounded-full bg-sky-600 px-4 py-2 text-white font-semibold">
            Export CSV analytics
          </a>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "sky" | "amber" | "rose" | "slate" }) {
  const toneClass = toneClasses(tone);
  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-extrabold mt-1">{value.toLocaleString("fr-FR")}</p>
    </article>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </p>
  );
}

function StackSlice({ color, value, total }: { color: string; value: number; total: number }) {
  if (!value) return null;
  const height = (value / Math.max(1, total)) * 100;
  return <div className={`absolute left-0 right-0 bottom-0 ${color}`} style={{ height: `${Math.max(2, height)}%` }} />;
}
