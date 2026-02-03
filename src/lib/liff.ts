import liff from "@line/liff";

export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "";

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

let isInitialized = false;

export async function initLiff(): Promise<boolean> {
  if (isInitialized) return true;
  
  if (!LIFF_ID) {
    console.warn("LIFF_ID is not set");
    return false;
  }

  try {
    await liff.init({ liffId: LIFF_ID });
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("LIFF init failed:", error);
    return false;
  }
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
