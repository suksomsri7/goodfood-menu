import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/restaurants - Get all restaurants
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const restaurants = await prisma.restaurant.findMany({
      where: active === "true" ? { isActive: true } : undefined,
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            foods: true,
            packages: true,
            categories: true,
          },
        },
      },
    });

    return NextResponse.json(restaurants);
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurants" },
      { status: 500 }
    );
  }
}

// POST /api/restaurants - Create new restaurant
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Generate slug from name if not provided
    if (!data.slug) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9ก-๙]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logoUrl,
        coverUrl: data.coverUrl,
        sellType: data.sellType || "both",
        deliveryFee: data.deliveryFee || 0,
        deliveryPerMeal: data.deliveryPerMeal || 0,
        minOrder: data.minOrder || 0,
        isActive: data.isActive ?? true,
        order: data.order || 0,
      },
    });

    return NextResponse.json(restaurant, { status: 201 });
  } catch (error) {
    console.error("Error creating restaurant:", error);
    return NextResponse.json(
      { error: "Failed to create restaurant" },
      { status: 500 }
    );
  }
}
