import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Count orders with PENDING status
    const count = await prisma.order.count({
      where: {
        status: "PENDING",
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching pending orders count:", error);
    return NextResponse.json({ count: 0 });
  }
}
