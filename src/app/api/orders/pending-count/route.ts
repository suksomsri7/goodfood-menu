import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/staffAuth";

export async function GET(request: NextRequest) {
  const gate = await requireStaff(request);
  if (gate instanceof NextResponse) return gate;

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
