import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { 
  pushMessage, 
  createOrderStatusFlexMessage,
  createOrderConfirmedFlexMessage,
  createOrderPreparingFlexMessage,
  createOrderShippingFlexMessage,
  createOrderCompletedFlexMessage
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

// PATCH - อัพเดทข้อมูล Order (สถานะ, หมายเหตุ, เลขพัสดุ, ราคา)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      status, 
      note, 
      trackingNumber, 
      carrier, 
      deliveryFee,
      discount,
      totalPrice,
      finalPrice,
      items,
      sendNotification = true 
    } = body;

    // ดึงข้อมูล order เดิมก่อน
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        member: true,
        items: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Update item prices if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id && item.price !== undefined) {
          await prisma.orderItem.update({
            where: { id: item.id },
            data: { price: item.price },
          });
        }
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(note !== undefined && { note }),
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(carrier !== undefined && { carrier }),
        ...(deliveryFee !== undefined && { deliveryFee }),
        ...(discount !== undefined && { discount }),
        ...(totalPrice !== undefined && { totalPrice }),
        ...(finalPrice !== undefined && { finalPrice }),
      },
      include: {
        items: true,
        member: true,
        restaurant: true,
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

              // Calculate final price
              const confirmedFinalPrice = order.finalPrice ?? (order.totalPrice + order.deliveryFee - order.discount);

              flexMessage = createOrderConfirmedFlexMessage(
                order.orderNumber,
                confirmedFinalPrice,
                paymentAccount ? {
                  bankName: paymentAccount.bankName,
                  accountName: paymentAccount.accountName,
                  accountNumber: paymentAccount.accountNumber,
                  qrCodeUrl: paymentAccount.qrCodeUrl,
                } : undefined,
                order.id // Pass orderId for quotation link
              );
              break;

            case "preparing":
              flexMessage = createOrderPreparingFlexMessage(order.orderNumber);
              break;

            case "shipping":
              // @ts-ignore - trackingNumber and carrier exist in schema
              const trackingNum = (order as any).trackingNumber;
              // @ts-ignore
              const carrierName = (order as any).carrier;
              flexMessage = createOrderShippingFlexMessage(
                order.orderNumber,
                trackingNum || undefined,
                carrierName || undefined
              );
              break;

            case "completed":
              flexMessage = createOrderCompletedFlexMessage(order.orderNumber);
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
