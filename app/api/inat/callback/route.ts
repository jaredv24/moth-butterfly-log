import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encryptSecret, verifyState } from "@/lib/crypto";
import { findUser } from "@/lib/data";
import { exchangeCode, getInatUser, getJwt } from "@/lib/inat";
import { inatRedirectUri } from "@/lib/inat-sync";

export const runtime = "nodejs";

function settingsRedirect(req: Request, params: string) {
  const url = new URL("/settings", req.url);
  url.search = params;
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const denied = sp.get("error");
  if (denied) return settingsRedirect(req, "inat=denied");

  const authCode = sp.get("code");
  const userCode = verifyState(sp.get("state") ?? "");
  if (!authCode || !userCode) return settingsRedirect(req, "inat=badstate");

  const user = await findUser(userCode);
  if (!user) return settingsRedirect(req, "inat=badstate");

  try {
    const accessToken = await exchangeCode(authCode, inatRedirectUri(req));
    const me = await getInatUser(await getJwt(accessToken));

    await db
      .update(users)
      .set({
        inatAccessToken: encryptSecret(accessToken),
        inatUsername: me.login,
        inatConnectedAt: new Date(),
        inatSyncEnabled: false,
      })
      .where(eq(users.id, user.id));

    return settingsRedirect(req, `inat=connected&user=${encodeURIComponent(me.login)}`);
  } catch (err) {
    console.error("iNat connect failed:", err);
    return settingsRedirect(req, "inat=error");
  }
}
