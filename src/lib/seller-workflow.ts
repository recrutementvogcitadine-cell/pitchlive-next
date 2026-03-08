export type SellerStatus = "pending_verification" | "rejected" | "approved" | "active";

export type SubscriptionStatus = "unpaid" | "pending_payment" | "paid" | "expired";

export type SellerRow = {
  id: string;
  user_id: string;
  store_name: string;
  whatsapp_number: string;
  category: string;
  country: string;
  city: string;
  identity_document_url: string | null;
  selfie_document_url: string | null;
  profile_photo_url: string | null;
  seller_status: SellerStatus;
  subscription_status: SubscriptionStatus;
  subscription_plan: "jour" | "semaine" | "mois" | null;
  subscription_expiry_date: string | null;
  created_at: string;
  updated_at: string;
};

export const SELLER_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const SELLER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const KYC_BUCKET = "kyc-documents";

export function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, "").trim();
}

export function normalizeSellerStatus(raw: string | null | undefined): SellerStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "approved") return "approved";
  if (value === "active") return "active";
  if (value === "rejected") return "rejected";
  return "pending_verification";
}

export function normalizeSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "pending_payment") return "pending_payment";
  if (value === "paid") return "paid";
  if (value === "expired") return "expired";
  return "unpaid";
}

export function canLaunchSellerLive(input: {
  sellerStatus?: string | null;
  subscriptionStatus?: string | null;
  expiryDate?: string | null;
}) {
  const sellerStatus = normalizeSellerStatus(input.sellerStatus);
  const subscriptionStatus = normalizeSubscriptionStatus(input.subscriptionStatus);
  if (sellerStatus !== "active" || subscriptionStatus !== "paid") return false;

  if (!input.expiryDate) return true;
  return new Date(input.expiryDate).getTime() > Date.now();
}
