import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushMessage, createTextMessage, createImageMessage, createStickerMessage } from "@/lib/line";
import { uploadToBunny } from "@/lib/bunny";

// POST - ส่งข้อความหา user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, content, imageUrl, packageId, stickerId } = body;

    // Get conversation
    const conversation = await prisma.lineConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    let messageContent: string | null = null;
    let finalImageUrl: string | null = null;
    let success = false;

    switch (type) {
      case "text": {
        if (!content) {
          return NextResponse.json(
            { error: "Content is required for text message" },
            { status: 400 }
          );
        }
        success = await pushMessage(conversation.lineUserId, [
          createTextMessage(content),
        ]);
        messageContent = content;
        break;
      }

      case "image": {
        if (!imageUrl) {
          return NextResponse.json(
            { error: "Image URL is required for image message" },
            { status: 400 }
          );
        }

        // If base64, upload to Bunny first
        if (imageUrl.startsWith("data:")) {
          finalImageUrl = await uploadToBunny(
            imageUrl,
            `line/outgoing-${Date.now()}.jpg`
          );
        } else {
          finalImageUrl = imageUrl;
        }

        if (finalImageUrl) {
          success = await pushMessage(conversation.lineUserId, [
            createImageMessage(finalImageUrl),
          ]);
          messageContent = finalImageUrl;
        }
        break;
      }

      case "sticker": {
        if (!packageId || !stickerId) {
          return NextResponse.json(
            { error: "Package ID and Sticker ID are required" },
            { status: 400 }
          );
        }
        success = await pushMessage(conversation.lineUserId, [
          createStickerMessage(packageId, stickerId),
        ]);
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid message type" },
          { status: 400 }
        );
    }

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send message to LINE" },
        { status: 500 }
      );
    }

    // Save message to database
    const message = await prisma.lineMessage.create({
      data: {
        conversationId: id,
        type,
        direction: "outgoing",
        content: messageContent,
        stickerPackageId: packageId,
        stickerId,
        isRead: true,
      },
    });

    // Update conversation lastMessageAt
    await prisma.lineConversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
