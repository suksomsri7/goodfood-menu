import { UserLayoutClient } from "./layout-client";

// Force dynamic rendering - prevent Vercel CDN from caching stale HTML
export const dynamic = "force-dynamic";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserLayoutClient>{children}</UserLayoutClient>;
}
