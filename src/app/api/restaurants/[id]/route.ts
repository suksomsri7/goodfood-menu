import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToBunny, deleteFromBunny, isBase64Image } from "@/lib/bunny";

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

    // Get existing restaurant for image cleanup
    const existing = await prisma.restaurant.findUnique({ where: { id } });

    // Handle logo upload/delete
    let logoUrl = data.logoUrl;
    if (data.logoUrl !== undefined) {
      if (data.logoUrl && isBase64Image(data.logoUrl)) {
        // Delete old logo and upload new one
        if (existing?.logoUrl) {
          await deleteFromBunny(existing.logoUrl);
        }
        logoUrl = await uploadToBunny(data.logoUrl, "restaurants/logos", `logo-${Date.now()}.jpg`);
      } else if (!data.logoUrl && existing?.logoUrl) {
        // Delete old logo
        await deleteFromBunny(existing.logoUrl);
        logoUrl = null;
      }
    }

    // Handle cover upload/delete
    let coverUrl = data.coverUrl;
    if (data.coverUrl !== undefined) {
      if (data.coverUrl && isBase64Image(data.coverUrl)) {
        // Delete old cover and upload new one
        if (existing?.coverUrl) {
          await deleteFromBunny(existing.coverUrl);
        }
        coverUrl = await uploadToBunny(data.coverUrl, "restaurants/covers", `cover-${Date.now()}.jpg`);
      } else if (!data.coverUrl && existing?.coverUrl) {
        // Delete old cover
        await deleteFromBunny(existing.coverUrl);
        coverUrl = null;
      }
    }

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl,
        coverUrl,
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

    // Get existing restaurant for image cleanup
    const existing = await prisma.restaurant.findUnique({ where: { id } });

    // Delete images from Bunny CDN
    if (existing?.logoUrl) {
      await deleteFromBunny(existing.logoUrl);
    }
    if (existing?.coverUrl) {
      await deleteFromBunny(existing.coverUrl);
    }

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
