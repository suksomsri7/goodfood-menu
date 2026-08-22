"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
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
  exchangeLiffSession,
  exchangeDevSession,
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
  const initStartTime = useRef<number>(0);

  useEffect(() => {
    const init = async () => {
      initStartTime.current = Date.now();
      
      try {
        // BACKOFFICE & PUBLIC pages: Skip LIFF completely
        const isLandingPage = pathname === '/' || pathname.startsWith('/articles');
        const isPublicPage = pathname.startsWith('/quotation');
        if (pathname.startsWith('/backoffice') || pathname.startsWith('/tip') || pathname.startsWith('/login') || isLandingPage || isPublicPage) {
          setIsReady(true);
          return;
        }

        // Check for dev mode query param (for testing in production)
        const urlParams = new URLSearchParams(window.location.search);
        const devMode = urlParams.get("dev") === "true";
        
        // DEV MODE: Skip LIFF and use mock profile
        // 🔴 ต้องมี ?code= ที่ตรงกับ DEV_LOGIN_CODE ด้วย — เดิม ?dev=true เฉย ๆ ก็สวมเป็น dev-user-001 ได้จากอินเทอร์เน็ต
        if (devMode) {
          const devCode = urlParams.get("code") || "";
          const ok = devCode ? await exchangeDevSession(devCode) : false;
          if (!ok) {
            setError("โหมดทดสอบต้องใส่ ?dev=true&code=<DEV_LOGIN_CODE>");
            setIsReady(true);
            return;
          }
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
          // 🔴 ต้องแลก session ให้เสร็จก่อนปล่อย profile ออกไป — หน้าต่าง ๆ ยิง /api/ ทันทีที่เห็น profile
          //    ถ้ายังไม่มีคุกกี้ ทุกคำขอจะได้ 401 (server ไม่เชื่อ lineUserId ใน query แล้ว)
          const sessionOk = await exchangeLiffSession(userProfile);
          if (!sessionOk) {
            setError("ยืนยันตัวตนกับ LINE ไม่สำเร็จ ลองเปิดหน้านี้ใหม่จากแอป LINE");
          }
          if (userProfile) {
            setProfile(userProfile);
          }

          const elapsed = Date.now() - initStartTime.current;
          console.log(`[LIFF] Ready in ${elapsed}ms (session=${sessionOk})`);
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

// สมัคร/อัปเดตโปรไฟล์ย้ายไปทำใน POST /api/auth/liff แล้ว (คำขอเดียวจบ + ตัวตนผ่าน LINE จริง)
