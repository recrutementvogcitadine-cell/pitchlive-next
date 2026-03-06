"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type IAgoraRTCClient = import("agora-rtc-sdk-ng").IAgoraRTCClient;
type ICameraVideoTrack = import("agora-rtc-sdk-ng").ICameraVideoTrack;
type IMicrophoneAudioTrack = import("agora-rtc-sdk-ng").IMicrophoneAudioTrack;

export default function CreatorStudioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("Live PITCH LIVE");
  const [busy, setBusy] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewersCount, setViewersCount] = useState(0);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);

  const creatorId = "main-creator";

  const startLive = async () => {
    if (!env.agoraAppId) {
      setError("NEXT_PUBLIC_AGORA_APP_ID manquant.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const response = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, creatorId }),
      });
      const body = (await response.json()) as { sessionId: string; channelName: string; token: string };

      const rtc = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      clientRef.current = rtc;

      await rtc.setClientRole("host");
      await rtc.join(env.agoraAppId, body.channelName, body.token, null);

      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          AEC: true,
          AGC: true,
          ANS: true,
        },
        {
          encoderConfig: {
            width: 720,
            height: 1280,
            frameRate: 30,
            bitrateMax: 1500,
            bitrateMin: 600,
          },
          optimizationMode: "motion",
        }
      );

      // Keep camera centered and avoid mirrored output for spectators.
      cameraTrack.play("creator-preview", { fit: "cover", mirror: false });

      camRef.current = cameraTrack;
      micRef.current = microphoneTrack;

      await rtc.publish([microphoneTrack, cameraTrack]);

      setSessionId(body.sessionId);
      setIsLive(true);

      const interval = window.setInterval(async () => {
        const { count } = await supabase
          .from("live_presence")
          .select("id", { count: "exact", head: true })
          .eq("live_session_id", body.sessionId);
        setViewersCount(count ?? 0);
      }, 3000);

      (window as unknown as { __viewerInterval?: number }).__viewerInterval = interval;
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const stopLive = async () => {
    setBusy(true);
    setError(null);

    try {
      if (sessionId) {
        await fetch("/api/live/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }

      await clientRef.current?.leave();
      camRef.current?.stop();
      micRef.current?.stop();
      camRef.current?.close();
      micRef.current?.close();

      const holder = window as unknown as { __viewerInterval?: number };
      if (holder.__viewerInterval) {
        window.clearInterval(holder.__viewerInterval);
        holder.__viewerInterval = undefined;
      }

      setIsLive(false);
      setSessionId(null);
      setViewersCount(0);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 md:p-8">
      <section className="mx-auto max-w-4xl grid gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Creator Studio</h1>
          <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">
            Voir le live public
          </Link>
        </div>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3">
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
              onClick={() => void startLive()}
              disabled={busy || isLive}
              className="rounded-xl bg-orange-500 px-4 py-3 font-bold disabled:opacity-50"
            >
              {busy && !isLive ? "Demarrage..." : "Lancer le live"}
            </button>

            <button
              type="button"
              onClick={() => void stopLive()}
              disabled={busy || !isLive}
              className="rounded-xl bg-slate-700 px-4 py-3 font-bold disabled:opacity-50"
            >
              {busy && isLive ? "Arret..." : "Arreter le live"}
            </button>
          </div>

          <div className="text-sm text-slate-300">
            Etat: <strong>{isLive ? "En direct" : "Hors ligne"}</strong> • Spectateurs connectes: {viewersCount}
          </div>

          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5">
          <h2 className="font-semibold mb-2">Apercu camera vertical</h2>
          <div className="relative w-full max-w-sm mx-auto aspect-[9/16] rounded-2xl overflow-hidden border border-slate-700 bg-slate-800">
            <div id="creator-preview" className="absolute inset-0" />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Reglages anti-zoom et anti-miroir actifs pour un rendu stable et naturel.
          </p>
        </article>
      </section>
    </main>
  );
}
