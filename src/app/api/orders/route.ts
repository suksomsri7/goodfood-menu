import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { pushMessage, createOrderFlexMessage } from "@/lib/line";

// สร้างเลข Order
function generateOrderNumber() {
  const date = new Date();
  const prefix = "GF";
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${year}${month}${day}${random}`;
}

// GET - ดึงรายการ Order
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");
    const lineUserId = searchParams.get("lineUserId");

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    
    // If lineUserId is provided, filter by member
    if (lineUserId) {
      const member = await prisma.member.findUnique({
        where: { lineUserId },
      });
      if (member) {
        where.memberId = member.id;
      } else {
        return NextResponse.json([]);
      }
    }

    const orders = await prisma.order.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit) : undefined,
      include: {
        items: {
          include: {
            food: true,
          },
        },
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
        restaurant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// POST - สร้าง Order ใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      coursePlan, 
      totalDays, 
      items, 
      totalPrice, 
      memberId, 
      lineUserId, 
      note,
      discount,
      discountType,
      discountValue,
      packageName,
      finalPrice,
      restaurantId,
      deliveryFee
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get memberId from lineUserId if provided
    let finalMemberId = memberId || null;
    if (lineUserId && !memberId) {
      const member = await prisma.member.findUnique({
        where: { lineUserId },
      });
      if (member) {
        finalMemberId = member.id;
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        coursePlan: coursePlan || "single",
        totalDays: totalDays || 1,
        totalPrice: totalPrice || 0,
        deliveryFee: deliveryFee || 0,
        discount: discount || 0,
        discountType: discountType || null,
        discountValue: discountValue || null,
        packageName: packageName || null,
        finalPrice: finalPrice || totalPrice || 0,
        memberId: finalMemberId,
        restaurantId: restaurantId || null,
        note: note || null,
        items: {
          create: items.map((item: {
            foodId: string;
            foodName: string;
            quantity: number;
            dayNumber?: number;
            mealType?: string;
            price: number;
            calories?: number;
          }) => ({
            foodId: item.foodId,
            foodName: item.foodName,
            quantity: item.quantity || 1,
            dayNumber: item.dayNumber || null,
            mealType: item.mealType || null,
            price: item.price || 0,
            calories: item.calories || null,
          })),
        },
      },
      include: {
        items: true,
        member: true,
      },
    });

    // ส่ง LINE Flex Message ยืนยัน Order ให้ลูกค้า
    if (lineUserId) {
      try {
        const flexMessage = createOrderFlexMessage({
          orderNumber: order.orderNumber,
          totalPrice: order.totalPrice,
          totalDays: order.totalDays || 1,
          coursePlan: order.coursePlan || "single",
          items: order.items.map((item) => ({
            foodName: item.foodName,
            quantity: item.quantity,
            price: item.price,
          })),
          status: order.status,
          discount: order.discount || 0,
          packageName: order.packageName || null,
          finalPrice: order.finalPrice || order.totalPrice,
        });

        await pushMessage(lineUserId, [flexMessage]);
        console.log(`Order confirmation sent to LINE user: ${lineUserId}`);
      } catch (error) {
        console.error("Failed to send LINE order confirmation:", error);
        // ไม่ให้ error นี้ทำให้ order creation fail
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
