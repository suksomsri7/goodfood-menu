import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

// GET - ดึงรายการ Order (สำหรับ Backoffice)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");

    const orders = await prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit) : undefined,
      include: {
        items: true,
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
    const { coursePlan, totalDays, items, totalPrice, memberId, note } = body;

    if (!coursePlan || !totalDays || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        coursePlan,
        totalDays,
        totalPrice: totalPrice || 0,
        memberId: memberId || null,
        note: note || null,
        items: {
          create: items.map((item: {
            foodId: string;
            foodName: string;
            quantity: number;
            dayNumber: number;
            mealType: string;
            price: number;
          }) => ({
            foodId: item.foodId,
            foodName: item.foodName,
            quantity: item.quantity || 1,
            dayNumber: item.dayNumber,
            mealType: item.mealType,
            price: item.price || 0,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
