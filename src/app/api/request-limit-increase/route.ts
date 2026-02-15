import { NextRequest, NextResponse } from "next/server";
import { pushMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { lineUserId } = await request.json();

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    // Get member info
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      select: { name: true, memberType: { select: { name: true } } },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Send message to user with instructions
    const message = {
      type: "flex" as const,
      altText: "วิธีเพิ่ม Limit การใช้งาน AI",
      contents: {
        type: "bubble" as const,
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "💡 วิธีเพิ่ม Limit การใช้งาน",
              weight: "bold",
              size: "lg",
              color: "#7C3AED",
            },
          ],
          paddingAll: "15px",
          backgroundColor: "#F3E8FF",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `สวัสดีคุณ ${member.name || "สมาชิก"} 👋`,
              size: "md",
              wrap: true,
            },
            {
              type: "text",
              text: `ประเภทสมาชิกปัจจุบัน: ${member.memberType?.name || "ทั่วไป"}`,
              size: "sm",
              color: "#666666",
              margin: "md",
              wrap: true,
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "text",
              text: "วิธีเพิ่ม Limit:",
              weight: "bold",
              margin: "lg",
              size: "md",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              spacing: "md",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "1.",
                      size: "sm",
                      color: "#7C3AED",
                      flex: 0,
                    },
                    {
                      type: "text",
                      text: "รอวันพรุ่งนี้ (Limit รีเซ็ตทุกวัน)",
                      size: "sm",
                      wrap: true,
                      margin: "sm",
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "2.",
                      size: "sm",
                      color: "#7C3AED",
                      flex: 0,
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "sm",
                      contents: [
                        {
                          type: "text",
                          text: "อัพเกรดเป็นสมาชิก Premium",
                          size: "sm",
                          wrap: true,
                          weight: "bold",
                        },
                        {
                          type: "text",
                          text: "เพียง 299 บาท ใช้ได้ Unlimited 30 วัน",
                          size: "xs",
                          color: "#E91E63",
                          wrap: true,
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "3.",
                      size: "sm",
                      color: "#7C3AED",
                      flex: 0,
                    },
                    {
                      type: "text",
                      text: "สั่งอาหารจาก เมนูสั่งอาหาร",
                      size: "sm",
                      wrap: true,
                      margin: "sm",
                    },
                  ],
                },
              ],
            },
          ],
          paddingAll: "15px",
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "message",
                label: "สมัคร Premium 299 บาท",
                text: "สมัคร Premium",
              },
              style: "primary",
              color: "#7C3AED",
            },
          ],
          paddingAll: "15px",
        },
      },
    };

    const success = await pushMessage(lineUserId, [message]);

    if (success) {
      return NextResponse.json({ success: true, message: "ส่งข้อความสำเร็จ" });
    } else {
      return NextResponse.json(
        { error: "ไม่สามารถส่งข้อความได้" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error requesting limit increase:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
