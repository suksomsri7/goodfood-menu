import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get cart items for a user (optionally filtered by restaurant)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const restaurantId = searchParams.get("restaurantId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // Build where clause - filter by restaurant if provided
    const where: { memberId: string; restaurantId?: string } = { memberId: member.id };
    if (restaurantId) {
      where.restaurantId = restaurantId;
    }

    const cartItems = await prisma.cartItem.findMany({
      where,
      include: {
        food: {
          include: {
            category: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = cartItems.reduce(
      (sum, item) => sum + item.food.price * item.quantity,
      0
    );

    return NextResponse.json({ items: cartItems, total });
  } catch (error) {
    console.error("Failed to get cart:", error);
    return NextResponse.json(
      { error: "Failed to get cart" },
      { status: 500 }
    );
  }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, foodId, quantity = 1, restaurantId } = body;

    if (!lineUserId || !foodId) {
      return NextResponse.json(
        { error: "lineUserId and foodId are required" },
        { status: 400 }
      );
    }

    // Get or create member
    let member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      member = await prisma.member.create({
        data: { lineUserId },
      });
    }

    // If adding to a different restaurant, clear cart first
    if (restaurantId) {
      const existingItems = await prisma.cartItem.findMany({
        where: { 
          memberId: member.id,
          restaurantId: { not: restaurantId },
        },
      });
      
      if (existingItems.length > 0) {
        // Clear items from other restaurants
        await prisma.cartItem.deleteMany({
          where: { 
            memberId: member.id,
            restaurantId: { not: restaurantId },
          },
        });
      }
    }

    // Upsert cart item
    const cartItem = await prisma.cartItem.upsert({
      where: {
        memberId_foodId: {
          memberId: member.id,
          foodId,
        },
      },
      update: {
        quantity: { increment: quantity },
        restaurantId: restaurantId || undefined,
      },
      create: {
        memberId: member.id,
        foodId,
        quantity,
        restaurantId: restaurantId || null,
      },
      include: {
        food: true,
      },
    });

    return NextResponse.json(cartItem);
  } catch (error) {
    console.error("Failed to add to cart:", error);
    return NextResponse.json(
      { error: "Failed to add to cart" },
      { status: 500 }
    );
  }
}

// PATCH - Update cart item quantity
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, foodId, quantity } = body;

    if (!lineUserId || !foodId || quantity === undefined) {
      return NextResponse.json(
        { error: "lineUserId, foodId, and quantity are required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      await prisma.cartItem.delete({
        where: {
          memberId_foodId: {
            memberId: member.id,
            foodId,
          },
        },
      });
      return NextResponse.json({ deleted: true });
    }

    const cartItem = await prisma.cartItem.update({
      where: {
        memberId_foodId: {
          memberId: member.id,
          foodId,
        },
      },
      data: { quantity },
      include: { food: true },
    });

    return NextResponse.json(cartItem);
  } catch (error) {
    console.error("Failed to update cart:", error);
    return NextResponse.json(
      { error: "Failed to update cart" },
      { status: 500 }
    );
  }
}

// DELETE - Clear cart (optionally for specific restaurant)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const restaurantId = searchParams.get("restaurantId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json({ success: true });
    }

    // Build where clause - clear only for specific restaurant if provided
    const where: { memberId: string; restaurantId?: string } = { memberId: member.id };
    if (restaurantId) {
      where.restaurantId = restaurantId;
    }

    await prisma.cartItem.deleteMany({ where });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear cart:", error);
    return NextResponse.json(
      { error: "Failed to clear cart" },
      { status: 500 }
    );
  }
}
