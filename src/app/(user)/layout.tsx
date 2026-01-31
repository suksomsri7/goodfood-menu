import { FloatingAddButton } from "@/components/user/FloatingAddButton";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 to-white">
      {children}
      <FloatingAddButton />
    </div>
  );
}
