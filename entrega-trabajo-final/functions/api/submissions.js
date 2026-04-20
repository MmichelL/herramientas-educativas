export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
export async function onRequestGet() {
  return new Response(JSON.stringify({ submissions: [] }), {
    headers: { "Content-Type": "application/json" },
  });
}
export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
