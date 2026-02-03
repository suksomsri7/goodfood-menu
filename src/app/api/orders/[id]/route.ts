import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { pushMessage, createOrderStatusFlexMessage } from "@/lib/line";

// GET - ดึงข้อมูล Order ตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        member: {
          select: {
            id: true,
            lineUserId: true,
            displayName: true,
            pictureUrl: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทข้อมูล Order (สถานะ, หมายเหตุ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, note, sendNotification = true } = body;

    // ดึงข้อมูล order เดิมก่อน
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        member: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(note !== undefined && { note }),
      },
      include: {
        items: true,
        member: {
          select: {
            id: true,
            lineUserId: true,
            displayName: true,
            pictureUrl: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    // ส่ง LINE notification เมื่อสถานะเปลี่ยน
    if (status && status !== existingOrder.status && sendNotification) {
      const lineUserId = existingOrder.member?.lineUserId;
      if (lineUserId) {
        try {
          const statusMessages: Record<string, string> = {
            confirmed: "ออเดอร์ของคุณได้รับการยืนยันแล้ว กำลังจัดเตรียมให้คุณ",
            preparing: "กำลังเตรียมอาหารให้คุณ รอสักครู่นะคะ",
            delivered: "อาหารถูกจัดส่งแล้ว ขอบคุณที่ใช้บริการ 💚",
            cancelled: "ออเดอร์ถูกยกเลิก หากมีข้อสงสัยกรุณาติดต่อเรา",
          };

          const flexMessage = createOrderStatusFlexMessage(
            order.orderNumber,
            status,
            statusMessages[status]
          );

          await pushMessage(lineUserId, [flexMessage]);
          console.log(`Order status update sent to LINE user: ${lineUserId}`);
        } catch (error) {
          console.error("Failed to send LINE status update:", error);
        }
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

// DELETE - ลบ Order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.order.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
