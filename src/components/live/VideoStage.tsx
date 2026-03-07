"use client";

import { useMemo } from "react";

type FloatingHeart = {
  id: string;
  left: number;
  size: number;
  hue: number;
};

type Props = {
  floatingHearts: FloatingHeart[];
  onStageTap: () => void;
  playerId?: string;
  children?: React.ReactNode;
};

export default function VideoStage({ floatingHearts, onStageTap, playerId = "agora-player", children }: Props) {
  const gradient = useMemo(
    () =>
      "linear-gradient(180deg, rgba(10,14,23,0.06) 0%, rgba(5,10,22,0.45) 43%, rgba(5,10,22,0.94) 100%)",
    []
  );

  return (
    <section className="stage" onClick={onStageTap}>
      <div className="stageVideoFrame">
        <div className="stageVideoBackdrop" />
        <div className="stageVideoGradient" style={{ background: gradient }} />
        <div id={playerId} className="agoraPlayer" />
      </div>
      {floatingHearts.map((heart) => (
        <span
          key={heart.id}
          className="floatingHeart"
          style={{
            left: `${heart.left}%`,
            fontSize: `${heart.size}px`,
            color: `hsl(${heart.hue}, 95%, 62%)`,
          }}
        >
          ♥
        </span>
      ))}
      {children}
    </section>
  );
}
