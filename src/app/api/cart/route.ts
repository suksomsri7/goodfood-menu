import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get cart items for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

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

    const cartItems = await prisma.cartItem.findMany({
      where: { memberId: member.id },
      include: {
        food: {
          include: {
            category: true,
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
    const { lineUserId, foodId, quantity = 1 } = body;

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
      },
      create: {
        memberId: member.id,
        foodId,
        quantity,
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

// DELETE - Clear cart
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

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

    await prisma.cartItem.deleteMany({
      where: { memberId: member.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear cart:", error);
    return NextResponse.json(
      { error: "Failed to clear cart" },
      { status: 500 }
    );
  }
}
