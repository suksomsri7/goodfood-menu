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
        text: `${item.foodName}`,
        size: "sm",
        color: "#555555",
        flex: 0,
        wrap: true,
      },
      {
        type: "text",
        text: `x${item.quantity}`,
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
          flex: 0,
          wrap: false,
        },
        {
          type: "text",
          text: "",
          size: "sm",
          color: "#111111",
          align: "end",
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
          text: "ขอบคุณที่ใช้บริการ GoodFood 💚",
          size: "xs",
          color: "#AAAAAA",
          align: "center",
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
  }
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
      text: "คำสั่งซื้อได้รับการยืนยันแล้ว",
      size: "sm",
      color: "#555555",
      align: "center",
      margin: "lg",
      wrap: true,
    },
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "text",
      text: "กรุณาชำระเงินได้ที่",
      size: "sm",
      color: "#555555",
      align: "center",
      margin: "lg",
      weight: "bold",
    },
  ];

  // Add payment account info if available
  if (paymentAccount) {
    bodyContents.push(
      {
        type: "box",
        layout: "vertical",
        margin: "md",
        contents: [
          {
            type: "text",
            text: paymentAccount.bankName,
            size: "md",
            color: "#111111",
            align: "center",
            weight: "bold",
          },
          {
            type: "text",
            text: paymentAccount.accountName,
            size: "sm",
            color: "#555555",
            align: "center",
            margin: "xs",
          },
          {
            type: "text",
            text: paymentAccount.accountNumber,
            size: "lg",
            color: "#4CAF50",
            align: "center",
            margin: "xs",
            weight: "bold",
          },
        ],
      }
    );

    // Add QR Code if available
    if (paymentAccount.qrCodeUrl) {
      bodyContents.push(
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          alignItems: "center",
          contents: [
            {
              type: "image",
              url: paymentAccount.qrCodeUrl,
              size: "lg",
              aspectRatio: "1:1",
              aspectMode: "fit",
            },
          ],
        }
      );
    }
  }

  // Add total price
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
          text: "ยอดชำระ",
          size: "md",
          color: "#555555",
          weight: "bold",
        },
        {
          type: "text",
          text: `฿${totalPrice.toLocaleString()}`,
          size: "lg",
          color: "#4CAF50",
          weight: "bold",
          align: "end",
        },
      ],
    }
  );

  const flexContents: FlexContainer = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      paddingAll: "20px",
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
  baseUrl: string = "https://goodfood-menu.vercel.app"
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
