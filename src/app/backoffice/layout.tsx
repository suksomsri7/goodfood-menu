import { Sidebar } from "@/components/backoffice/Sidebar";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar />
      <main className="ml-60 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
