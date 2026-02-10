import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadToBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงรายการแพ็คเกจทั้งหมด
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId");

    const packages = await prisma.package.findMany({
      where: {
        ...(restaurantId && { restaurantId }),
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return NextResponse.json(packages);
  } catch (error) {
    console.error("Error fetching packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

// POST - สร้างแพ็คเกจใหม่
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, requiredItems, discountType, discountValue, freeItems, imageUrl, restaurantId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Upload image to Bunny CDN if it's base64
    let finalImageUrl = imageUrl || null;
    if (imageUrl && isBase64Image(imageUrl)) {
      try {
        finalImageUrl = await uploadToBunny(imageUrl, "packages", "package.jpg");
      } catch (uploadError) {
        console.error("Failed to upload package image:", uploadError);
      }
    }

    // Handle null discount values properly
    const parsedDiscountValue = discountValue !== null && discountValue !== undefined && discountValue !== "" 
      ? parseFloat(discountValue) 
      : null;

    const newPackage = await prisma.package.create({
      data: {
        name,
        description: description || null,
        requiredItems: parseInt(requiredItems) || 1,
        discountType: discountType || null,
        discountValue: parsedDiscountValue,
        freeItems: parseInt(freeItems) || 0,
        imageUrl: finalImageUrl,
        restaurantId: restaurantId || null,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(newPackage, { status: 201 });
  } catch (error) {
    console.error("Error creating package:", error);
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}
