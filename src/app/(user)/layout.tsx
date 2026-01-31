import { FloatingAddButton } from "@/components/user/FloatingAddButton";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
      <FloatingAddButton />
    </div>
  );
}
