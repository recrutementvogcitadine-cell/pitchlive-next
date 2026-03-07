export type LiveSession = {
  id: string;
  creator_id: string;
  channel_name: string;
  title: string;
  status: "live" | "ended";
  started_at: string;
  ended_at: string | null;
  likes_count: number;
  viewers_count: number;
};

export type LiveMessage = {
  id: string;
  live_session_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
};

export type LiveGift = {
  id: string;
  live_session_id: string;
  user_id: string;
  username: string;
  gift_type: string;
  created_at: string;
};

export type LiveLike = {
  id: string;
  live_session_id: string;
  user_id: string;
  created_at: string;
};

export type DashboardStats = {
  activeLives: number;
  totalLives: number;
  totalMessages: number;
  totalLikes: number;
  totalGifts: number;
  totalFollowers: number;
  totalPresence: number;
  totalSellerProfiles: number;
  totalPushSubscriptions: number;
};
