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
        type: "bubble",
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
              contents: [
                {
                  type: "text",
                  text: "1. อัพเกรดเป็นสมาชิก Premium",
                  size: "sm",
                  wrap: true,
                },
                {
                  type: "text",
                  text: "2. รอจนกว่าจะถึงวันใหม่ (Limit รีเซ็ตทุกวัน)",
                  size: "sm",
                  wrap: true,
                  margin: "sm",
                },
                {
                  type: "text",
                  text: "3. ติดต่อแอดมินเพื่อขอเพิ่ม Limit พิเศษ",
                  size: "sm",
                  wrap: true,
                  margin: "sm",
                },
              ],
            },
            {
              type: "text",
              text: "พิมพ์ 'อัพเกรด' หรือ 'ติดต่อแอดมิน' เพื่อดำเนินการ",
              size: "xs",
              color: "#888888",
              margin: "xl",
              wrap: true,
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
