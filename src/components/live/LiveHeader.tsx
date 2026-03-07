type Props = {
  sellerName: string;
  likes: number;
  isFollowing: boolean;
  onFollow: () => void;
  onClose: () => void;
};

function toCompactCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString("fr-FR");
}

function getAvatarInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "V";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function LiveHeader({ sellerName, likes, isFollowing, onFollow, onClose }: Props) {
  return (
    <header className="liveHeader">
      <div className="sellerIdentityBlock">
        <div className="sellerAvatar" aria-hidden>
          {getAvatarInitials(sellerName)}
        </div>
        <div className="sellerMeta">
          <h1>{sellerName}</h1>
          <p>{toCompactCount(likes)} coeurs</p>
        </div>
      </div>

      <button type="button" className="followTopButton" onClick={onFollow}>
        {isFollowing ? "Suivi" : "+ Suivre"}
      </button>

      <div className="liveTopRight">
        <span className="liveDot" aria-hidden />
        <button type="button" className="closeLiveButton" onClick={onClose} aria-label="Fermer le live">
          x
        </button>
      </div>
    </header>
  );
}
