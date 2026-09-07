import { NextResponse } from "next/server";
import { signState } from "@/lib/crypto";
import { findUser } from "@/lib/data";
import { authorizeUrl, inatConfigured } from "@/lib/inat";
import { inatRedirectUri } from "@/lib/inat-sync";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!inatConfigured()) {
    return NextResponse.json({ error: "iNaturalist is not configured" }, { status: 501 });
  }
  const code = normalizeUserCode(new URL(req.url).searchParams.get("code") ?? "");
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "valid ?code= is required" }, { status: 400 });
  }
  if (!(await findUser(code))) {
    return NextResponse.json({ error: "unknown code" }, { status: 404 });
  }

  const state = signState(code);
  return NextResponse.redirect(authorizeUrl(state, inatRedirectUri(req)));
}
