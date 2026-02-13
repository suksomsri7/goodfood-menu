import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.goodfood.in.th";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/backoffice/",
          "/cal/",
          "/menu/",
          "/orders/",
          "/goal/",
          "/login/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
