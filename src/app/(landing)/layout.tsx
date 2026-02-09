import { Prompt } from "next/font/google";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${prompt.className} bg-white min-h-screen`}>
      {children}
    </div>
  );
}
