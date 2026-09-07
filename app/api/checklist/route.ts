import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getChecklist();
  return NextResponse.json({
    count: rows.length,
    species: rows.map((r) => ({
      id: r.id,
      inatTaxonId: r.inatTaxonId,
      commonName: r.commonName,
      scientificName: r.scientificName,
      group: r.taxonGroup,
      family: r.family,
      thumbUrl: r.thumbUrl,
    })),
  });
}
