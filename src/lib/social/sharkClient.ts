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

// Use Node's https module directly — the globalThis fetch that Next.js wraps in
// route handlers was silently downgrading POST→GET despite `cache:"no-store"`.
// This skill we use small enough that hand-rolling the request is simpler than
// adding an HTTP-client dependency.
async function rawRequest(
  fullUrl: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; statusText: string; text: string }> {
  const https = await import("node:https");
  const { URL } = await import("node:url");
  const u = new URL(fullUrl);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: {
          ...headers,
          ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || "",
            text: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function callShark<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, brandId, apiKey } = await loadConfig();
  const fullPath = path.replace(":brandId", brandId);
  const method = (init.method as string | undefined) || "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-shark-api-key": apiKey,
    ...((init.headers as Record<string, string>) || {}),
  };
  const body = init.body ? String(init.body) : undefined;
  const res = await rawRequest(`${url}${fullPath}`, method, headers, body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`SHARK ${res.status} ${res.statusText}: ${res.text.slice(0, 200)}`);
  }
  return JSON.parse(res.text) as T;
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
