import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
          borderRadius: "36px",
        }}
      >
        <svg
          width="110"
          height="110"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fork */}
          <path
            d="M30 15 L30 45 Q30 55 35 55 L35 85 Q35 88 37.5 88 Q40 88 40 85 L40 55 Q45 55 45 45 L45 15"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <line x1="35" y1="15" x2="35" y2="38" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="40" y1="15" x2="40" y2="38" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          {/* Spoon */}
          <ellipse cx="65" cy="28" rx="12" ry="16" fill="white" opacity="0.95" />
          <rect x="62.5" y="42" width="5" height="46" rx="2.5" fill="white" opacity="0.95" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
