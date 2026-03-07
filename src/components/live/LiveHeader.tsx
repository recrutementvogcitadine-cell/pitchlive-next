type Props = {
  sellerName: string;
  likes: number;
  viewers: number;
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

export default function LiveHeader({ sellerName, likes, viewers, isFollowing, onFollow, onClose }: Props) {
  return (
    <header className="liveHeader">
      <div className="sellerIdentityBlock">
        <img
          className="sellerAvatar"
          src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(sellerName)}`}
          alt={`Profil ${sellerName}`}
        />
        <div className="sellerMeta">
          <h1>{sellerName}</h1>
          <p>{toCompactCount(likes)} coeurs</p>
        </div>
      </div>

      <div className="topRightActions">
        <button type="button" className="followTopButton" onClick={onFollow}>
          {isFollowing ? "Suivi" : "+ Suivre"}
        </button>
        <div className="liveStatusPill">
          <span className="liveDot" aria-hidden />
          LIVE
        </div>
        <div className="viewerPill">{toCompactCount(viewers)}</div>
        <button type="button" className="closeLiveButton" onClick={onClose} aria-label="Fermer le live">
          x
        </button>
      </div>

      <div className="headerSubPills">
        <span className="subPill">Classement quotidien</span>
        <span className="subPill">Match de ligue</span>
      </div>
    </header>
  );
}
