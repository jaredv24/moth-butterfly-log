import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:hello@example.com";

export const pushConfigured = !!(publicKey && privateKey);
if (pushConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

type Payload = {
  title: string;
  body: string;
  url: string;
  badgeCount?: number;
  tag?: string;
};

/** Fan a notification out to every device a user has subscribed. Soft-fails. */
export async function pushToUser(userId: string, payload: Payload) {
  if (!pushConfigured) return;
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (!subs.length) return;

  const json = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
          { TTL: 3600 },
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, s.endpoint));
        }
      }
    }),
  );
}
