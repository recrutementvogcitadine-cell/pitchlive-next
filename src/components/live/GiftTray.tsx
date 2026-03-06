"use client";

const gifts = [
  { key: "rose", label: "Rose" },
  { key: "spark", label: "Spark" },
  { key: "crown", label: "Crown" },
  { key: "fire", label: "Fire" },
];

type Props = {
  onSendGift: (giftType: string) => void;
};

export default function GiftTray({ onSendGift }: Props) {
  return (
    <div className="giftTray">
      {gifts.map((gift) => (
        <button key={gift.key} type="button" onClick={() => onSendGift(gift.key)} className="giftChip">
          {gift.label}
        </button>
      ))}
    </div>
  );
}
