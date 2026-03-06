type Props = {
  title: string;
  viewers: number;
  likes: number;
};

export default function LiveHeader({ title, viewers, likes }: Props) {
  return (
    <header className="liveHeader">
      <div className="liveBadge">LIVE</div>
      <div className="liveMeta">
        <h1>{title}</h1>
        <p>{viewers.toLocaleString("fr-FR")} spectateurs • {likes.toLocaleString("fr-FR")} likes</p>
      </div>
    </header>
  );
}
