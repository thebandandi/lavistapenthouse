import { getStore } from "@netlify/blobs";

export default async () => {
  const store = getStore("direct-bookings");
  const { blobs } = await store.list();
  for (const blob of blobs) {
    await store.delete(blob.key);
  }
  return new Response(JSON.stringify({ message: "Vault Wiped Clean!" }), { status: 200 });
};
