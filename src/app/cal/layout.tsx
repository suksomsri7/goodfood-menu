import { CalLayoutClient } from "./layout-client";

// Force dynamic rendering - prevent Vercel CDN from caching stale HTML
export const dynamic = "force-dynamic";

export default function CalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CalLayoutClient>{children}</CalLayoutClient>;
}
