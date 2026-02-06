import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST - เพิ่มยอดวิว
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const article = await prisma.article.update({
      where: { id },
      data: {
        views: { increment: 1 },
      },
    });

    return NextResponse.json({ views: article.views });
  } catch (error) {
    console.error("Error incrementing view:", error);
    return NextResponse.json(
      { error: "Failed to increment view" },
      { status: 500 }
    );
  }
}
