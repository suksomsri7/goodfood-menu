import crypto from "crypto";

// LINE Configuration
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || "2009042388";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "36a019f5fd41c43ecf404204faceecd0";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

const LINE_API_BASE = "https://api.line.me/v2";
const LINE_DATA_API_BASE = "https://api-data.line.me/v2";

// Types
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LineTextMessage {
  type: "text";
  text: string;
}

export interface LineImageMessage {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
}

export interface LineStickerMessage {
  type: "sticker";
  packageId: string;
  stickerId: string;
}

export type LineMessage = LineTextMessage | LineImageMessage | LineStickerMessage;

// Verify webhook signature
export function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// Get user profile
export async function getUserProfile(userId: string): Promise<LineProfile | null> {
  try {
    const response = await fetch(`${LINE_API_BASE}/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to get user profile:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

// Send reply message (ตอบกลับภายใน webhook)
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  try {
    const response = await fetch(`${LINE_API_BASE}/bot/message/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to reply message:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error replying message:", error);
    return false;
  }
}

// Send push message (ส่งข้อความหาผู้ใช้โดยตรง)
export async function pushMessage(userId: string, messages: LineMessage[]): Promise<boolean> {
  try {
    const response = await fetch(`${LINE_API_BASE}/bot/message/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to push message:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error pushing message:", error);
    return false;
  }
}

// Get message content (รูปภาพ, วีดีโอ, ไฟล์)
export async function getMessageContent(messageId: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(`${LINE_DATA_API_BASE}/bot/message/${messageId}/content`, {
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to get message content:", response.status);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error getting message content:", error);
    return null;
  }
}

// Upload image and get URL (ใช้ Bunny CDN)
export async function uploadLineMediaToBunny(
  messageId: string,
  type: "image" | "video" | "audio" | "file",
  fileName?: string
): Promise<string | null> {
  try {
    const content = await getMessageContent(messageId);
    if (!content) return null;

    // Import bunny utilities
    const { uploadToBunny } = await import("./bunny");

    // Convert to base64
    const base64 = Buffer.from(content).toString("base64");
    const extension = type === "image" ? "jpg" : type === "video" ? "mp4" : type === "audio" ? "m4a" : "file";
    const mimeType = type === "image" ? "image/jpeg" : type === "video" ? "video/mp4" : type === "audio" ? "audio/m4a" : "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Upload to Bunny
    const finalFileName = fileName || `line-${type}-${messageId}.${extension}`;
    const url = await uploadToBunny(dataUrl, `line/${finalFileName}`);

    return url;
  } catch (error) {
    console.error("Error uploading LINE media to Bunny:", error);
    return null;
  }
}

// Create text message helper
export function createTextMessage(text: string): LineTextMessage {
  return { type: "text", text };
}

// Create image message helper
export function createImageMessage(originalUrl: string, previewUrl?: string): LineImageMessage {
  return {
    type: "image",
    originalContentUrl: originalUrl,
    previewImageUrl: previewUrl || originalUrl,
  };
}

// Create sticker message helper
export function createStickerMessage(packageId: string, stickerId: string): LineStickerMessage {
  return {
    type: "sticker",
    packageId,
    stickerId,
  };
}
