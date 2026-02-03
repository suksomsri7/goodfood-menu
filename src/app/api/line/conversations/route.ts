import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - ดึงรายการ conversations ทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");

    const conversations = await prisma.lineConversation.findMany({
      where: {
        isActive: true,
        ...(search && {
          displayName: {
            contains: search,
            mode: "insensitive",
          },
        }),
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Transform data
    const result = conversations.map((conv) => ({
      id: conv.id,
      lineUserId: conv.lineUserId,
      displayName: conv.displayName || "Unknown",
      pictureUrl: conv.pictureUrl,
      statusMessage: conv.statusMessage,
      lastMessage: conv.messages[0] || null,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: conv.unreadCount,
      createdAt: conv.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
