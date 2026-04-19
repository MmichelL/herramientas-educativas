// Stub — implementación real en Task 2
export async function onRequestGet() {
  return new Response(JSON.stringify({ stub: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
