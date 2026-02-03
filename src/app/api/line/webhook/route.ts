import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature, getUserProfile, uploadLineMediaToBunny } from "@/lib/line";

// LINE Webhook Event Types
interface LineEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    packageId?: string;
    stickerId?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    contentProvider?: {
      type: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
    };
  };
  postback?: {
    data: string;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// Webhook verification (GET)
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

// Webhook handler (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    // Verify signature (skip in development if needed)
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(body, signature)) {
        console.error("Invalid LINE webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const webhookBody: LineWebhookBody = JSON.parse(body);
    console.log("LINE webhook received:", JSON.stringify(webhookBody, null, 2));

    // Process events
    for (const event of webhookBody.events) {
      await processEvent(event);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processEvent(event: LineEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  switch (event.type) {
    case "message":
      await handleMessage(event);
      break;
    case "follow":
      await handleFollow(userId);
      break;
    case "unfollow":
      await handleUnfollow(userId);
      break;
    case "postback":
      await handlePostback(event);
      break;
    default:
      console.log("Unhandled event type:", event.type);
  }
}

async function handleMessage(event: LineEvent) {
  const userId = event.source.userId;
  if (!userId || !event.message) return;

  // Get or create conversation
  let conversation = await prisma.lineConversation.findUnique({
    where: { lineUserId: userId },
  });

  if (!conversation) {
    // Get user profile from LINE
    const profile = await getUserProfile(userId);

    conversation = await prisma.lineConversation.create({
      data: {
        lineUserId: userId,
        displayName: profile?.displayName || "Unknown",
        pictureUrl: profile?.pictureUrl,
        statusMessage: profile?.statusMessage,
      },
    });
  }

  // Process message based on type
  const message = event.message;
  let content: string | null = null;
  let mediaUrl: string | null = null;
  let previewUrl: string | null = null;

  switch (message.type) {
    case "text":
      content = message.text || "";
      break;

    case "image":
      // Upload image to Bunny CDN
      mediaUrl = await uploadLineMediaToBunny(message.id, "image");
      content = mediaUrl;
      if (message.contentProvider?.previewImageUrl) {
        previewUrl = message.contentProvider.previewImageUrl;
      }
      break;

    case "video":
      mediaUrl = await uploadLineMediaToBunny(message.id, "video");
      content = mediaUrl;
      if (message.contentProvider?.previewImageUrl) {
        previewUrl = message.contentProvider.previewImageUrl;
      }
      break;

    case "audio":
      mediaUrl = await uploadLineMediaToBunny(message.id, "audio");
      content = mediaUrl;
      break;

    case "file":
      mediaUrl = await uploadLineMediaToBunny(message.id, "file", message.fileName);
      content = mediaUrl;
      break;

    case "sticker":
      // Sticker doesn't need content URL
      break;

    case "location":
      content = `Location: ${message.text || ""}`;
      break;

    default:
      content = `[${message.type}]`;
  }

  // Save message to database
  await prisma.lineMessage.create({
    data: {
      conversationId: conversation.id,
      lineMessageId: message.id,
      type: message.type,
      direction: "incoming",
      content,
      stickerPackageId: message.packageId,
      stickerId: message.stickerId,
      previewUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      duration: message.duration,
    },
  });

  // Update conversation
  await prisma.lineConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
      // Update profile if changed
      displayName: conversation.displayName,
    },
  });

  console.log(`Message received from ${conversation.displayName}: ${content || message.type}`);
}

async function handleFollow(userId: string) {
  // Get user profile
  const profile = await getUserProfile(userId);

  // Create or update conversation
  await prisma.lineConversation.upsert({
    where: { lineUserId: userId },
    update: {
      displayName: profile?.displayName || "Unknown",
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      isActive: true,
    },
    create: {
      lineUserId: userId,
      displayName: profile?.displayName || "Unknown",
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
    },
  });

  console.log(`User followed: ${profile?.displayName || userId}`);
}

async function handleUnfollow(userId: string) {
  // Mark conversation as inactive
  await prisma.lineConversation.updateMany({
    where: { lineUserId: userId },
    data: { isActive: false },
  });

  console.log(`User unfollowed: ${userId}`);
}

async function handlePostback(event: LineEvent) {
  if (!event.postback) return;
  console.log("Postback received:", event.postback.data);
  // Handle postback actions if needed
}
