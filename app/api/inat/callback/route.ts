import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encryptSecret, verifyState } from "@/lib/crypto";
import { findUser } from "@/lib/data";
import { exchangeCode, getInatUser, getJwt } from "@/lib/inat";
import { inatRedirectUri } from "@/lib/inat-sync";

export const runtime = "nodejs";

function settingsRedirect(req: Request, params: string, toApp = false) {
  if (toApp) return NextResponse.redirect(`leplog://inat?${params}`);
  const url = new URL("/profile", req.url);
  url.search = params;
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const stateValue = verifyState(sp.get("state") ?? "");
  const toApp = !!stateValue?.endsWith(":app");
  const userCode = stateValue?.replace(/:app$/, "") ?? null;
  if (sp.get("error")) return settingsRedirect(req, "inat=denied", toApp);

  const authCode = sp.get("code");
  if (!authCode || !userCode) return settingsRedirect(req, "inat=badstate", toApp);

  const user = await findUser(userCode);
  if (!user) return settingsRedirect(req, "inat=badstate", toApp);

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

    return settingsRedirect(req, `inat=connected&user=${encodeURIComponent(me.login)}`, toApp);
  } catch (err) {
    console.error("iNat connect failed:", err);
    return settingsRedirect(req, "inat=error", toApp);
  }
}
