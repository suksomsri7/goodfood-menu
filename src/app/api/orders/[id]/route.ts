import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { 
  pushMessage, 
  createOrderStatusFlexMessage,
  createOrderConfirmedFlexMessage,
  createOrderPreparingFlexMessage,
  createOrderDeliveredFlexMessage
} from "@/lib/line";

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

// PATCH - อัพเดทข้อมูล Order (สถานะ, หมายเหตุ, เลขพัสดุ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, note, trackingNumber, carrier, sendNotification = true } = body;

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
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(carrier !== undefined && { carrier }),
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
          let flexMessage;

          switch (status) {
            case "confirmed":
              // ดึงข้อมูลบัญชีรับชำระเงิน
              const paymentAccount = await prisma.paymentAccount.findFirst({
                where: { isActive: true, isDefault: true },
              }) || await prisma.paymentAccount.findFirst({
                where: { isActive: true },
              });

              flexMessage = createOrderConfirmedFlexMessage(
                order.orderNumber,
                order.totalPrice,
                paymentAccount ? {
                  bankName: paymentAccount.bankName,
                  accountName: paymentAccount.accountName,
                  accountNumber: paymentAccount.accountNumber,
                  qrCodeUrl: paymentAccount.qrCodeUrl,
                } : undefined
              );
              break;

            case "preparing":
              flexMessage = createOrderPreparingFlexMessage(order.orderNumber);
              break;

            case "delivered":
              flexMessage = createOrderDeliveredFlexMessage(
                order.orderNumber,
                order.trackingNumber || undefined,
                order.carrier || undefined
              );
              break;

            case "cancelled":
              flexMessage = createOrderStatusFlexMessage(
                order.orderNumber,
                status,
                "ออเดอร์ถูกยกเลิก หากมีข้อสงสัยกรุณาติดต่อเรา"
              );
              break;

            default:
              flexMessage = createOrderStatusFlexMessage(order.orderNumber, status);
          }

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
