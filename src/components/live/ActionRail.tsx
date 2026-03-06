"use client";

import { Gift, Heart, Users } from "lucide-react";

type Props = {
  likes: number;
  gifts: number;
  followers: number;
  onLike: () => void;
  onGift: () => void;
  onFollow: () => void;
};

export default function ActionRail({ likes, gifts, followers, onLike, onGift, onFollow }: Props) {
  return (
    <aside className="actionRail">
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
