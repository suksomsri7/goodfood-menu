import liff from "@line/liff";

// LIFF IDs for different pages
export const LIFF_IDS = {
  cal: process.env.NEXT_PUBLIC_LIFF_ID_CAL || "",
  goal: process.env.NEXT_PUBLIC_LIFF_ID_GOAL || "",
  menu: process.env.NEXT_PUBLIC_LIFF_ID_MENU || "",
  orders: process.env.NEXT_PUBLIC_LIFF_ID_ORDERS || "",
} as const;

export type LiffPage = keyof typeof LIFF_IDS;

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

let isInitialized = false;
let currentLiffId = "";

export function getLiffIdForPath(pathname: string): string {
  if (pathname.includes("/cal")) return LIFF_IDS.cal;
  if (pathname.includes("/goal")) return LIFF_IDS.goal;
  if (pathname.includes("/menu")) return LIFF_IDS.menu;
  if (pathname.includes("/orders")) return LIFF_IDS.orders;
  return LIFF_IDS.cal; // default
}

export async function initLiff(liffId: string): Promise<boolean> {
  // If already initialized with the same ID, return true
  if (isInitialized && currentLiffId === liffId) return true;
  
  if (!liffId) {
    console.warn("LIFF_ID is not set");
    return false;
  }

  try {
    await liff.init({ liffId });
    isInitialized = true;
    currentLiffId = liffId;
    return true;
  } catch (error) {
    console.error("LIFF init failed:", error);
    return false;
  }
}

export function isLiffInitialized(): boolean {
  return isInitialized;
}

export function isLoggedIn(): boolean {
  if (!isInitialized) return false;
  return liff.isLoggedIn();
}

export function login(redirectUri?: string): void {
  if (!isInitialized) return;
  // Use current URL as redirect target to preserve the page after login
  const uri = redirectUri || (typeof window !== 'undefined' ? window.location.href : undefined);
  liff.login(uri ? { redirectUri: uri } : undefined);
}

export function logout(): void {
  if (!isInitialized) return;
  liff.logout();
}

export async function getProfile(): Promise<LiffProfile | null> {
  if (!isInitialized || !liff.isLoggedIn()) return null;

  try {
    const profile = await liff.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
    };
  } catch (error) {
    console.error("Failed to get profile:", error);
    return null;
  }
}

export function isInClient(): boolean {
  if (!isInitialized) return false;
  return liff.isInClient();
}

export function getOS(): string | undefined {
  if (!isInitialized) return undefined;
  return liff.getOS();
}

export function closeWindow(): void {
  if (!isInitialized) return;
  liff.closeWindow();
}

export async function sendMessage(text: string): Promise<boolean> {
  // Try liff.sendMessages first (works only when opened from chat)
  if (isInitialized && liff.isInClient()) {
    try {
      await liff.sendMessages([{
        type: "text",
        text: text,
      }]);
      return true;
    } catch (error) {
      console.error("liff.sendMessages failed:", error);
      // Fall through to URL scheme
    }
  }
  
  // Fallback: Use LINE URL scheme to open chat and pre-fill message
  // This works even when opened from Rich Menu
  try {
    const encodedText = encodeURIComponent(text);
    // Open LINE app with the message pre-filled (user needs to tap send)
    window.location.href = `https://line.me/R/oaMessage/@goodfood.menu/?${encodedText}`;
    return true;
  } catch (error) {
    console.error("Failed to open LINE URL:", error);
    return false;
  }
}

export { liff };
