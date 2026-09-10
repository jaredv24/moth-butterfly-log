export const runtime = "nodejs";

/**
 * Fire-and-forget nudge to wake the ID service (BioCLIP on Modal scales to zero
 * when idle). The client hits this when the Identify screen opens, so the
 * container is warming while the user lines up their photo — hiding the cold
 * start behind the ~20-40s a person spends taking and framing a shot.
 */
export async function GET() {
  const endpoint = process.env.BIOCLIP_ENDPOINT;
  if (endpoint) {
    fetch(endpoint.replace(/\/$/, "") + "/", {
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  }
  return new Response(null, { status: 204 });
}
