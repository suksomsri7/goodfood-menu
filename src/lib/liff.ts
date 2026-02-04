import liff from "@line/liff";

// LIFF IDs for different pages
export const LIFF_IDS = {
  cal: process.env.NEXT_PUBLIC_LIFF_ID_CAL || "",
  goal: process.env.NEXT_PUBLIC_LIFF_ID_GOAL || "",
  menu: process.env.NEXT_PUBLIC_LIFF_ID_MENU || "",
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
  // #region agent log
  const result = pathname.includes("/cal") ? LIFF_IDS.cal : pathname.includes("/goal") ? LIFF_IDS.goal : pathname.includes("/menu") ? LIFF_IDS.menu : pathname.includes("/orders") ? LIFF_IDS.menu : LIFF_IDS.cal;
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'liff.ts:23',message:'getLiffIdForPath',data:{pathname,result,LIFF_IDS_cal:LIFF_IDS.cal,LIFF_IDS_goal:LIFF_IDS.goal,LIFF_IDS_menu:LIFF_IDS.menu},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H6'})}).catch(()=>{});
  // #endregion
  if (pathname.includes("/cal")) return LIFF_IDS.cal;
  if (pathname.includes("/goal")) return LIFF_IDS.goal;
  if (pathname.includes("/menu")) return LIFF_IDS.menu;
  if (pathname.includes("/orders")) return LIFF_IDS.menu; // Use menu LIFF ID for orders
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

export function login(): void {
  if (!isInitialized) return;
  liff.login();
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

export { liff };
