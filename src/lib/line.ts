import crypto from "crypto";

// LINE Configuration
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
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

export interface LineFlexMessage {
  type: "flex";
  altText: string;
  contents: FlexContainer;
}

export interface FlexContainer {
  type: "bubble" | "carousel";
  [key: string]: unknown;
}

export type LineMessage = LineTextMessage | LineImageMessage | LineStickerMessage | LineFlexMessage;

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

/**
 * 🔴 6 ส.ค. 2026 — ปิดการ "ยิงข้อความออก LINE เอง" (แจ้งเตือน/cron/บอทเก่า) ทั้งหมด
 *
 * เหตุผล: ยุค LINE ของแอปโค้ชเลิกใช้แล้ว การแจ้งเตือนทุกอย่างไปทาง push ของแอปทางเดียว
 * สมาชิกเก่าที่ยังผูก lineUserId แต่ไม่ได้ลงแอป เคยโดนโค้ชเช้ายิง Flex เข้า LINE ทุกเช้า
 * และ LINE OA กำลังจะถูกใช้ใหม่สำหรับ "รับออเดอร์อาหาร" — ห้ามบอทเก่าไปยิงอะไรรบกวน
 *
 * ถอดออกง่าย: ตั้งเป็น false = เปิดกลับทั้งระบบ ไม่ต้องไล่แก้หลายไฟล์
 *
 * ไม่ครอบ (ตั้งใจให้ทำงานต่อ):
 *  - replyMessage ใน webhook /api/line/webhook + coachChat (ตอบเมื่อมีคนทักเข้ามาเท่านั้น)
 *  - หน้าแชท backoffice (แอดมินกดส่งเอง)
 *  - ออเดอร์อาหาร /api/orders (ยืนยันออเดอร์ที่ user เป็นคนสั่งเอง)
 *  - LIFF / secret ของ LINE
 */
export const LINE_PROACTIVE_DISABLED = true;

/**
 * ส่ง LINE แบบ proactive (บอทเริ่มก่อน: cron/แจ้งเตือน/สรุป)
 * ทุกจุดที่ "บอทยิงหาเอง" ต้องผ่านฟังก์ชันนี้ ห้ามเรียก pushMessage ตรง
 */
export async function pushProactiveMessage(
  userId: string,
  messages: LineMessage[],
  source: string
): Promise<boolean> {
  if (LINE_PROACTIVE_DISABLED) {
    console.log(`[LINE] proactive ปิดอยู่ — ไม่ส่ง (${source})`);
    return false;
  }
  return pushMessage(userId, messages);
}

// Send push message (ส่งข้อความหาผู้ใช้โดยตรง)
export async function pushMessage(userId: string, messages: LineMessage[]): Promise<boolean> {
  try {
    console.log("[LINE] Pushing message:", { userId, hasToken: !!LINE_CHANNEL_ACCESS_TOKEN, messageCount: messages.length });

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      console.error("[LINE] No access token configured");
      return false;
    }

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
      console.error("[LINE] Push failed:", { userId, status: response.status, error });
      return false;
    }

    console.log("[LINE] Push success:", { userId });
    return true;
  } catch (error) {
    console.error("[LINE] Push exception:", { userId, error: String(error) });
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

// Create Flex Message helper
export function createFlexMessage(altText: string, contents: FlexContainer): LineFlexMessage {
  return {
    type: "flex",
    altText,
    contents,
  };
}

// Create Order Confirmation Flex Message
export function createOrderFlexMessage(order: {
  orderNumber: string;
  totalPrice: number;
  totalDays?: number;
  coursePlan?: string;
  items: Array<{ foodName: string; quantity: number; price: number }>;
  status: string;
  discount?: number;
  packageName?: string | null;
  finalPrice?: number;
  restaurantName?: string | null;
  deliveryFee?: number;
  deliveryName?: string | null;
  deliveryPhone?: string | null;
  deliveryAddress?: string | null;
}): LineFlexMessage {
  const statusLabels: Record<string, string> = {
    pending: "⏳ รอดำเนินการ",
    confirmed: "✅ ยืนยันคำสั่งซื้อ",
    preparing: "💰 รับชำระเงิน",
    shipping: "🚚 กำลังจัดส่ง",
    completed: "✅ จัดส่งเรียบร้อย",
    cancelled: "❌ ยกเลิก",
  };

  const statusColors: Record<string, string> = {
    pending: "#FFA000",
    confirmed: "#4CAF50",
    preparing: "#9C27B0",
    shipping: "#2196F3",
    completed: "#00897B",
    cancelled: "#F44336",
  };

  // สร้าง item list (แสดงสูงสุด 5 รายการ)
  const displayItems = order.items.slice(0, 5);
  const remainingCount = order.items.length - 5;

  const itemComponents = displayItems.map((item) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: item.foodName || "รายการอาหาร",
        size: "sm",
        color: "#555555",
        flex: 0,
        wrap: true,
      },
      {
        type: "text",
        text: `x${item.quantity || 1}`,
        size: "sm",
        color: "#111111",
        align: "end",
      },
    ],
  }));

  if (remainingCount > 0) {
    itemComponents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: `และอีก ${remainingCount} รายการ...`,
          size: "xs",
          color: "#AAAAAA",
          flex: 1,
          wrap: false,
        },
      ],
    });
  }

  const flexContents: FlexContainer = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "🍽️ GoodFood",
              weight: "bold",
              color: "#4CAF50",
              size: "sm",
            },
            {
              type: "text",
              text: statusLabels[order.status] || order.status,
              weight: "bold",
              color: statusColors[order.status] || "#666666",
              size: "xs",
              align: "end",
            },
          ],
        },
      ],
      paddingAll: "15px",
      backgroundColor: "#F8F9FA",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "คำสั่งซื้อของคุณ",
          weight: "bold",
          size: "xl",
          margin: "none",
        },
        {
          type: "text",
          text: `#${order.orderNumber}`,
          size: "sm",
          color: "#4CAF50",
          margin: "sm",
        },
        // Restaurant name (if available)
        ...(order.restaurantName
          ? [
              {
                type: "text" as const,
                text: `🏪 ${order.restaurantName}`,
                size: "sm" as const,
                color: "#555555",
                margin: "sm" as const,
              },
            ]
          : []),
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: itemComponents,
        },
        {
          type: "separator",
          margin: "lg",
        },
        // ราคาสินค้า
        {
          type: "box",
          layout: "horizontal",
          margin: "lg",
          contents: [
            {
              type: "text",
              text: "ราคาสินค้า",
              size: "sm",
              color: "#555555",
            },
            {
              type: "text",
              text: `฿${order.totalPrice.toLocaleString()}`,
              size: "sm",
              color: "#555555",
              align: "end",
            },
          ],
        },
        // ส่วนลด (ถ้ามี)
        ...(order.discount && order.discount > 0
          ? [
              {
                type: "box" as const,
                layout: "horizontal" as const,
                margin: "sm" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: order.packageName ? `🎉 ${order.packageName}` : "ส่วนลด",
                    size: "sm" as const,
                    color: "#4CAF50",
                  },
                  {
                    type: "text" as const,
                    text: `-฿${order.discount.toLocaleString()}`,
                    size: "sm" as const,
                    color: "#4CAF50",
                    align: "end" as const,
                  },
                ],
              },
            ]
          : []),
        // ค่าจัดส่ง (ถ้ามี)
        ...(order.deliveryFee && order.deliveryFee > 0
          ? [
              {
                type: "box" as const,
                layout: "horizontal" as const,
                margin: "sm" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: "🚚 ค่าจัดส่ง",
                    size: "sm" as const,
                    color: "#555555",
                  },
                  {
                    type: "text" as const,
                    text: `฿${order.deliveryFee.toLocaleString()}`,
                    size: "sm" as const,
                    color: "#555555",
                    align: "end" as const,
                  },
                ],
              },
            ]
          : []),
        // ที่อยู่จัดส่ง (ถ้ามี)
        ...(order.deliveryName || order.deliveryAddress
          ? [
              {
                type: "separator" as const,
                margin: "lg" as const,
              },
              {
                type: "text" as const,
                text: "📍 ที่อยู่จัดส่ง",
                size: "sm" as const,
                color: "#555555",
                weight: "bold" as const,
                margin: "lg" as const,
              },
              ...(order.deliveryName
                ? [
                    {
                      type: "text" as const,
                      text: `${order.deliveryName}${order.deliveryPhone ? ` (${order.deliveryPhone})` : ""}`,
                      size: "sm" as const,
                      color: "#111111",
                      margin: "sm" as const,
                      wrap: true,
                    },
                  ]
                : []),
              ...(order.deliveryAddress
                ? [
                    {
                      type: "text" as const,
                      text: order.deliveryAddress,
                      size: "xs" as const,
                      color: "#666666",
                      margin: "xs" as const,
                      wrap: true,
                    },
                  ]
                : []),
              {
                type: "separator" as const,
                margin: "lg" as const,
              },
            ]
          : []),
        // รวมทั้งหมด
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            {
              type: "text",
              text: "รวมทั้งหมด",
              size: "md",
              color: "#111111",
              weight: "bold",
            },
            {
              type: "text",
              text: `฿${(order.finalPrice ?? order.totalPrice).toLocaleString()}`,
              size: "lg",
              color: "#4CAF50",
              weight: "bold",
              align: "end",
            },
          ],
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "กรุณารอตรวจสอบรายการสั่งซื้อ และการจัดส่ง",
          size: "xs",
          color: "#FF8C00",
          align: "center",
          wrap: true,
        },
        {
          type: "text",
          text: "พนักงานจะติดต่อกลับอย่างเร็วที่สุด",
          size: "xs",
          color: "#FF8C00",
          align: "center",
          wrap: true,
        },
        {
          type: "separator",
          margin: "sm",
        },
        {
          type: "text",
          text: "ขอบคุณที่ใช้บริการ GoodFood 💚",
          size: "xs",
          color: "#AAAAAA",
          align: "center",
          margin: "sm",
        },
      ],
      paddingAll: "15px",
    },
    styles: {
      header: {
        separator: false,
      },
    },
  };

  return createFlexMessage(`คำสั่งซื้อ #${order.orderNumber}`, flexContents);
}

// Create Order Status Update Flex Message (Generic)
export function createOrderStatusFlexMessage(
  orderNumber: string,
  status: string,
  message?: string
): LineFlexMessage {
  const statusLabels: Record<string, { text: string; emoji: string; color: string }> = {
    pending: { text: "รอดำเนินการ", emoji: "⏳", color: "#FFA000" },
    confirmed: { text: "ยืนยันคำสั่งซื้อ", emoji: "✅", color: "#4CAF50" },
    preparing: { text: "รับชำระเงิน", emoji: "💰", color: "#9C27B0" },
    shipping: { text: "กำลังจัดส่ง", emoji: "🚚", color: "#2196F3" },
    completed: { text: "จัดส่งเรียบร้อย", emoji: "✅", color: "#00897B" },
    cancelled: { text: "ยกเลิก", emoji: "❌", color: "#F44336" },
  };

  const statusInfo = statusLabels[status] || { text: status, emoji: "📋", color: "#666666" };

  const flexContents: FlexContainer = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: statusInfo.emoji,
          size: "3xl",
          align: "center",
        },
        {
          type: "text",
          text: statusInfo.text,
          weight: "bold",
          size: "xl",
          align: "center",
          margin: "md",
          color: statusInfo.color,
        },
        {
          type: "text",
          text: `#${orderNumber}`,
          size: "sm",
          color: "#AAAAAA",
          align: "center",
          margin: "sm",
        },
        ...(message
          ? [
              {
                type: "text" as const,
                text: message,
                size: "sm" as const,
                color: "#555555",
                align: "center" as const,
                margin: "lg" as const,
                wrap: true,
              },
            ]
          : []),
      ],
      paddingAll: "20px",
    },
  };

  return createFlexMessage(`อัปเดตสถานะ: ${statusInfo.text}`, flexContents);
}

// Create Order Confirmed Flex Message with Payment Info
export function createOrderConfirmedFlexMessage(
  orderNumber: string,
  totalPrice: number,
  paymentAccount?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    qrCodeUrl?: string | null;
  },
  orderId?: string
): LineFlexMessage {
  const bodyContents: unknown[] = [
    {
      type: "text",
      text: "✅",
      size: "3xl",
      align: "center",
    },
    {
      type: "text",
      text: "ยืนยันคำสั่งซื้อ",
      weight: "bold",
      size: "xl",
      align: "center",
      margin: "md",
      color: "#4CAF50",
    },
    {
      type: "text",
      text: `#${orderNumber}`,
      size: "sm",
      color: "#AAAAAA",
      align: "center",
      margin: "sm",
    },
    {
      type: "text",
      text: "คำสั่งซื้อได้รับการยืนยันแล้ว\nกรุณาตรวจสอบรายละเอียดและชำระเงิน",
      size: "sm",
      color: "#555555",
      align: "center",
      margin: "lg",
      wrap: true,
    },
  ];

  // Add total price summary
  bodyContents.push(
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        {
          type: "text",
          text: "ยอดที่ต้องชำระ",
          size: "md",
          color: "#555555",
          weight: "bold",
        },
        {
          type: "text",
          text: `฿${totalPrice.toLocaleString()}`,
          size: "xl",
          color: "#4CAF50",
          weight: "bold",
          align: "end",
        },
      ],
    }
  );

  // Build URL for quotation page
  const quotationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.goodfood.in.th"}/quotation/${orderId || ""}`;

  const flexContents: FlexContainer = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#4CAF50",
          height: "md",
          action: {
            type: "uri",
            label: "ดูรายละเอียดการชำระเงิน",
            uri: quotationUrl,
          },
        },
      ],
    },
  };

  return createFlexMessage(`ยืนยันคำสั่งซื้อ #${orderNumber}`, flexContents);
}

// Create Order Preparing Flex Message (Payment Received)
export function createOrderPreparingFlexMessage(orderNumber: string): LineFlexMessage {
  const flexContents: FlexContainer = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "👨‍🍳",
          size: "3xl",
          align: "center",
        },
        {
          type: "text",
          text: "กำลังเตรียมอาหาร",
          weight: "bold",
          size: "xl",
          align: "center",
          margin: "md",
          color: "#9C27B0",
        },
        {
          type: "text",
          text: `#${orderNumber}`,
          size: "sm",
          color: "#AAAAAA",
          align: "center",
          margin: "sm",
        },
        {
          type: "text",
          text: "รับชำระเงินเรียบร้อย\nเชฟกำลังจัดเตรียมอาหารสำหรับคุณ",
          size: "sm",
          color: "#555555",
          align: "center",
          margin: "lg",
          wrap: true,
        },
      ],
      paddingAll: "20px",
    },
  };

  return createFlexMessage(`กำลังเตรียมอาหาร #${orderNumber}`, flexContents);
}

// Create Order Shipping Flex Message with Tracking Info (กำลังจัดส่ง)
export function createOrderShippingFlexMessage(
  orderNumber: string,
  trackingNumber?: string,
  carrier?: string
): LineFlexMessage {
  const bodyContents: unknown[] = [
    {
      type: "text",
      text: "🚚",
      size: "3xl",
      align: "center",
    },
    {
      type: "text",
      text: "กำลังจัดส่ง",
      weight: "bold",
      size: "xl",
      align: "center",
      margin: "md",
      color: "#2196F3",
    },
    {
      type: "text",
      text: `#${orderNumber}`,
      size: "sm",
      color: "#AAAAAA",
      align: "center",
      margin: "sm",
    },
    {
      type: "text",
      text: "พัสดุของคุณกำลังถูกจัดส่ง",
      size: "sm",
      color: "#555555",
      align: "center",
      margin: "md",
    },
  ];

  // Add tracking info if available
  if (trackingNumber) {
    bodyContents.push(
      {
        type: "separator",
        margin: "lg",
      },
      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        contents: [
          {
            type: "text",
            text: "📦 เลขพัสดุ",
            size: "sm",
            color: "#555555",
            align: "center",
          },
          {
            type: "text",
            text: trackingNumber,
            size: "lg",
            color: "#2196F3",
            align: "center",
            margin: "xs",
            weight: "bold",
          },
          ...(carrier
            ? [
                {
                  type: "text" as const,
                  text: `ขนส่ง: ${carrier}`,
                  size: "sm" as const,
                  color: "#888888",
                  align: "center" as const,
                  margin: "xs" as const,
                },
              ]
            : []),
        ],
      }
    );
  }

  bodyContents.push(
    {
      type: "text",
      text: "ขอบคุณที่ใช้บริการ GoodFood 💚",
      size: "xs",
      color: "#AAAAAA",
      align: "center",
      margin: "lg",
    }
  );

  const flexContents: FlexContainer = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      paddingAll: "20px",
    },
  };

  return createFlexMessage(`กำลังจัดส่ง #${orderNumber}`, flexContents);
}

// Create Order Completed Flex Message (จัดส่งเรียบร้อย)
export function createOrderCompletedFlexMessage(
  orderNumber: string,
  baseUrl: string = "https://www.goodfood.in.th"
): LineFlexMessage {
  const flexContents: FlexContainer = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✅",
          size: "3xl",
          align: "center",
        },
        {
          type: "text",
          text: "จัดส่งเรียบร้อย",
          weight: "bold",
          size: "xl",
          align: "center",
          margin: "md",
          color: "#00897B",
        },
        {
          type: "text",
          text: `#${orderNumber}`,
          size: "sm",
          color: "#AAAAAA",
          align: "center",
          margin: "sm",
        },
        {
          type: "text",
          text: "พัสดุของคุณถูกจัดส่งเรียบร้อยแล้ว\nขอบคุณที่ใช้บริการ GoodFood 💚",
          size: "sm",
          color: "#555555",
          align: "center",
          margin: "lg",
          wrap: true,
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#00897B",
          action: {
            type: "uri",
            label: "📋 ตรวจสอบรายการอาหาร",
            uri: `${baseUrl}/orders`,
          },
        },
      ],
      paddingAll: "15px",
    },
  };

  return createFlexMessage(`จัดส่งเรียบร้อย #${orderNumber}`, flexContents);
}
