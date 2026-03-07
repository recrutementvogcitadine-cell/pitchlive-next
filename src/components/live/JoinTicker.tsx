type JoinTickerItem = {
  id: string;
  name: string;
};

type Props = {
  items: JoinTickerItem[];
  mode?: "overlay" | "inline";
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "V";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function JoinTicker({ items, mode = "overlay" }: Props) {
  if (!items.length) return null;

  const repeated = [...items, ...items];

  return (
    <section className={`joinTicker ${mode === "inline" ? "joinTickerInline" : ""}`} aria-label="Participants qui rejoignent le live">
      <div className="joinTickerTrack">
        {repeated.map((item, index) => (
          <div className="joinTickerChip" key={`${item.id}-${index}`}>
            <span className="joinTickerAvatar" aria-hidden>
              {initialsFromName(item.name)}
            </span>
            <span className="joinTickerName">{item.name}</span>
            <span className="joinTickerJoin">a rejoint</span>
          </div>
        ))}
      </div>
    </section>
  );
}
