export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  agoraAppId: process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "",
  sellerStoreUrl: process.env.NEXT_PUBLIC_SELLER_STORE_URL ?? "",
  sellerWhatsapp: process.env.NEXT_PUBLIC_SELLER_WHATSAPP ?? "",
  webPushPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function hasClientEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.agoraAppId);
}
