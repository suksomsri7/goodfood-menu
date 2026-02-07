import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายการออเดอร์ของสมาชิก
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [orders, totalCount, totalSpent] = await Promise.all([
      prisma.order.findMany({
        where: { memberId: id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          items: {
            include: {
              food: {
                select: { name: true, imageUrl: true },
              },
            },
          },
          restaurant: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
      }),
      prisma.order.count({ where: { memberId: id } }),
      prisma.order.aggregate({
        where: { memberId: id },
        _sum: { finalPrice: true },
      }),
    ]);

    // Format orders
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalPrice: order.totalPrice,
      finalPrice: order.finalPrice,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => ({
        id: item.id,
        foodName: item.foodName,
        foodImage: item.food?.imageUrl,
        quantity: item.quantity,
        price: item.price,
        calories: item.calories,
      })),
      restaurant: order.restaurant,
      createdAt: order.createdAt,
    }));

    return NextResponse.json({
      orders: formattedOrders,
      stats: {
        totalOrders: totalCount,
        totalSpent: totalSpent._sum.finalPrice || 0,
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching member orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch member orders" },
      { status: 500 }
    );
  }
}
