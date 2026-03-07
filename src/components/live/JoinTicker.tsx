type JoinTickerItem = {
  id: string;
  name: string;
};

type Props = {
  items: JoinTickerItem[];
  mode?: "overlay" | "inline";
};

export default function JoinTicker({ items, mode = "overlay" }: Props) {
  if (!items.length) return null;

  const repeated = [...items, ...items];

  return (
    <section className={`joinTicker ${mode === "inline" ? "joinTickerInline" : ""}`} aria-label="Participants qui rejoignent le live">
      <div className="joinTickerTrack">
        {repeated.map((item, index) => (
          <div className="joinTickerChip" key={`${item.id}-${index}`}>
            <img
              className="joinTickerAvatar"
              src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(item.name)}`}
              alt={`Profil ${item.name}`}
            />
            <span className="joinTickerName">{item.name}</span>
            <span className="joinTickerJoin">a rejoint</span>
          </div>
        ))}
      </div>
    </section>
  );
}
