"use client";

import { Gift, Heart, MessageCircle, ShoppingBag, Users } from "lucide-react";

type Props = {
  likes: number;
  gifts: number;
  followers: number;
  onLike: () => void;
  onGift: () => void;
  onFollow: () => void;
  onStore: () => void;
  onWhatsApp: () => void;
};

export default function ActionRail({
  likes,
  gifts,
  followers,
  onLike,
  onGift,
  onFollow,
  onStore,
  onWhatsApp,
}: Props) {
  return (
    <aside className="actionRail">
      <button type="button" onClick={onStore} className="railButton" aria-label="Ouvrir la boutique">
        <ShoppingBag size={22} />
        <span>Shop</span>
      </button>
      <button type="button" onClick={onWhatsApp} className="railButton" aria-label="Contacter sur WhatsApp">
        <MessageCircle size={22} />
        <span>WA</span>
      </button>
      <button type="button" onClick={onLike} className="railButton">
        <Heart size={22} />
        <span>{likes}</span>
      </button>
      <button type="button" onClick={onGift} className="railButton">
        <Gift size={22} />
        <span>{gifts}</span>
      </button>
      <button type="button" onClick={onFollow} className="railButton">
        <Users size={22} />
        <span>{followers}</span>
      </button>
    </aside>
  );
}
