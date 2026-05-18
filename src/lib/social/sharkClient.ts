import { getSecret } from "@/lib/secrets/store";

export type SharkChannel = {
  id: string;
  platform: string;
  name: string;
  pageId?: string | null;
  igUserId?: string | null;
  picture?: string | null;
};

async function loadConfig() {
  const [url, brandId, apiKey] = await Promise.all([
    getSecret("SHARK_URL"),
    getSecret("SHARK_BRAND_ID"),
    getSecret("SHARK_API_KEY"),
  ]);
  if (!url || !brandId || !apiKey) {
    throw new Error("SHARK_URL / SHARK_BRAND_ID / SHARK_API_KEY ยังไม่ได้ตั้งค่า (Settings → API Keys)");
  }
  return { url: url.replace(/\/+$/, ""), brandId, apiKey };
}

async function callShark<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, brandId, apiKey } = await loadConfig();
  const fullPath = path.replace(":brandId", brandId);
  const res = await fetch(`${url}${fullPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-shark-api-key": apiKey,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SHARK ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function sharkListChannels(): Promise<SharkChannel[]> {
  return callShark<SharkChannel[]>("/api/brands/:brandId/content/social/channels");
}

export type SharkPublishInput = {
  channelIds: string[];
  text: string;
  mediaUrl?: string;
  extraMediaUrls?: string[];
  firstComment?: string;
  scheduledAt?: Date;
  now?: boolean;
};

export async function sharkPublish(input: SharkPublishInput): Promise<any> {
  return callShark("/api/brands/:brandId/content/social/publish", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      scheduledAt: input.scheduledAt ? input.scheduledAt.toISOString() : undefined,
    }),
  });
}

/**
 * Lightweight ping — used by the backoffice "test connection" button. Reuses
 * the channels endpoint since GET is cheap and exercises the same auth path.
 */
export async function sharkPing(): Promise<{ ok: true; channelCount: number } | { ok: false; error: string }> {
  try {
    const list = await sharkListChannels();
    return { ok: true, channelCount: list.length };
  } catch (e: any) {
    return { ok: false, error: e?.message || "ping failed" };
  }
}
