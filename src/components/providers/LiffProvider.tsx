"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  initLiff,
  getProfile,
  isLoggedIn,
  login,
  isInClient,
  getLiffIdForPath,
  LiffProfile,
} from "@/lib/liff";

interface LiffContextType {
  isReady: boolean;
  isLoggedIn: boolean;
  isInClient: boolean;
  profile: LiffProfile | null;
  error: string | null;
  login: () => void;
}

const LiffContext = createContext<LiffContextType>({
  isReady: false,
  isLoggedIn: false,
  isInClient: false,
  profile: null,
  error: null,
  login: () => {},
});

export function useLiff() {
  return useContext(LiffContext);
}

interface LiffProviderProps {
  children: ReactNode;
}

export function LiffProvider({ children }: LiffProviderProps) {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [inClient, setInClient] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // BACKOFFICE: Skip LIFF completely - no authentication required
        if (pathname.startsWith('/backoffice')) {
          setIsReady(true);
          return;
        }

        // Check for dev mode query param (for testing in production)
        const urlParams = new URLSearchParams(window.location.search);
        const devMode = urlParams.get("dev") === "true";
        
        // DEV MODE: Skip LIFF and use mock profile
        if (devMode) {
          console.log("🔧 Dev mode enabled: Using mock LIFF profile");
          setProfile({
            userId: "dev-user-001",
            displayName: "Developer (Test Mode)",
            pictureUrl: undefined,
          });
          setLoggedIn(true);
          setInClient(false);
          setIsReady(true);
          return;
        }
        
        // Get LIFF ID based on current path
        const liffId = getLiffIdForPath(pathname);
        
        const success = await initLiff(liffId);

        if (!success) {
          // Development mode without LIFF ID - use mock profile
          if (process.env.NODE_ENV === "development" && !liffId) {
            console.log("🔧 Development mode: Using mock LIFF profile");
            setProfile({
              userId: "dev-user-001",
              displayName: "Developer",
              pictureUrl: undefined,
            });
            setLoggedIn(true);
            setIsReady(true);
            return;
          }

          setError("LIFF initialization failed");
          setIsReady(true);
          return;
        }

        setInClient(isInClient());
        const loggedInCheck = isLoggedIn();

        if (loggedInCheck) {
          setLoggedIn(true);
          const userProfile = await getProfile();
          if (userProfile) {
            setProfile(userProfile);

            // Register/update user in database
            await registerUser(userProfile);
          }
        } else {
          // Not logged in - trigger login (works in both LIFF browser and external browser)
          login();
        }

        setIsReady(true);
      } catch (err) {
        console.error("LIFF init error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsReady(true);
      }
    };

    init();
  }, [pathname]);

  return (
    <LiffContext.Provider
      value={{
        isReady,
        isLoggedIn: loggedIn,
        isInClient: inClient,
        profile,
        error,
        login,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

// Register or update user in database
async function registerUser(profile: LiffProfile) {
  try {
    await fetch("/api/members/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
      }),
    });
  } catch (error) {
    console.error("Failed to register user:", error);
  }
}
