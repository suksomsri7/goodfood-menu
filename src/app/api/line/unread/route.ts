import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - ดึงจำนวนข้อความที่ยังไม่ได้อ่านทั้งหมด
export async function GET() {
  try {
    const result = await prisma.lineConversation.aggregate({
      _sum: {
        unreadCount: true,
      },
      where: {
        isActive: true,
      },
    });

    return NextResponse.json({
      unreadCount: result._sum.unreadCount || 0,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
