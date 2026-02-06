import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/restaurants/[id] - Get restaurant by ID with all data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: {
            foods: {
              where: { isActive: true },
              orderBy: { order: "asc" },
            },
          },
        },
        packages: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            foods: true,
            packages: true,
            categories: true,
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(restaurant);
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurant" },
      { status: 500 }
    );
  }
}

// PUT /api/restaurants/[id] - Update restaurant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logoUrl,
        coverUrl: data.coverUrl,
        sellType: data.sellType,
        deliveryFee: data.deliveryFee,
        deliveryPerMeal: data.deliveryPerMeal,
        minOrder: data.minOrder,
        isActive: data.isActive,
        order: data.order,
      },
    });

    return NextResponse.json(restaurant);
  } catch (error) {
    console.error("Error updating restaurant:", error);
    return NextResponse.json(
      { error: "Failed to update restaurant" },
      { status: 500 }
    );
  }
}

// DELETE /api/restaurants/[id] - Delete restaurant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.restaurant.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting restaurant:", error);
    return NextResponse.json(
      { error: "Failed to delete restaurant" },
      { status: 500 }
    );
  }
}
