import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - ดึงข้อมูล conversation และ messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before"); // cursor for pagination

    const conversation = await prisma.lineConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await prisma.lineMessage.findMany({
      where: {
        conversationId: id,
        ...(before && {
          createdAt: { lt: new Date(before) },
        }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Mark as read
    await prisma.lineConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    await prisma.lineMessage.updateMany({
      where: {
        conversationId: id,
        direction: "incoming",
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      conversation,
      messages: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}
