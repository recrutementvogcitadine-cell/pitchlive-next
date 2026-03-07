import webpush from "web-push";

let configured = false;

export function configureWebPush() {
  if (configured) return true;

  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.WEB_PUSH_VAPID_PRIVATE_KEY ?? "").trim();
  const subject = (process.env.WEB_PUSH_VAPID_SUBJECT ?? "mailto:support@pitchci.com").trim();

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    return false;
  }

  configured = true;
  return true;
}

export function getWebPushPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
}

export { webpush };
