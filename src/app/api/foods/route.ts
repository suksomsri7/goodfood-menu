import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToBunny, uploadMultipleToBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงรายการเมนูอาหารทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const isActive = searchParams.get("isActive");

    const restaurantId = searchParams.get("restaurantId");

    const foods = await prisma.food.findMany({
      where: {
        ...(categoryId && { categoryId }),
        ...(restaurantId && { restaurantId }),
        ...(isActive !== null && { isActive: isActive === "true" }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Add cache headers - foods data changes infrequently
    const response = NextResponse.json(foods);
    response.headers.set(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300"
    );
    return response;
  } catch (error) {
    console.error("Error fetching foods:", error);
    return NextResponse.json(
      { error: "Failed to fetch foods" },
      { status: 500 }
    );
  }
}

// POST - สร้างเมนูอาหารใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      ingredients,
      imageUrl,
      images,
      price,
      discountPrice,
      badge,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      servingSize,
      servingUnit,
      warning,
      categoryId,
      restaurantId,
    } = body;

    // Validation
    if (!name || !price || !calories || !protein || !carbs || !fat || !categoryId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่า category มีอยู่จริง
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 400 }
      );
    }

    // Upload main image to Bunny CDN if it's base64
    let finalImageUrl = imageUrl || null;
    if (imageUrl && isBase64Image(imageUrl)) {
      try {
        finalImageUrl = await uploadToBunny(imageUrl, "foods", "main.jpg");
      } catch (uploadError: any) {
        console.error("Failed to upload main image:", uploadError);
        // ใช้ base64 เดิมถ้า upload ไม่สำเร็จ (fallback)
      }
    }

    // Upload additional images to Bunny CDN
    let finalImages: string[] = [];
    if (images && images.length > 0) {
      const base64Images = images.filter((img: string) => isBase64Image(img));
      const urlImages = images.filter((img: string) => !isBase64Image(img));
      
      if (base64Images.length > 0) {
        try {
          const uploadedUrls = await uploadMultipleToBunny(base64Images, "foods");
          finalImages = [...urlImages, ...uploadedUrls];
        } catch (uploadError) {
          console.error("Failed to upload additional images:", uploadError);
          finalImages = urlImages;
        }
      } else {
        finalImages = urlImages;
      }
    }

    const food = await prisma.food.create({
      data: {
        name,
        description: description || null,
        ingredients: ingredients || [],
        imageUrl: finalImageUrl,
        images: finalImages,
        price: parseFloat(price),
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        badge: badge || null,
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        fiber: fiber ? parseFloat(fiber) : null,
        sugar: sugar ? parseFloat(sugar) : null,
        sodium: sodium ? parseFloat(sodium) : null,
        servingSize: servingSize ? parseFloat(servingSize) : null,
        servingUnit: servingUnit || null,
        warning: warning || null,
        categoryId,
        restaurantId: restaurantId || null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json(food, { status: 201 });
  } catch (error: any) {
    console.error("Error creating food:", error);
    return NextResponse.json(
      { error: "Failed to create food" },
      { status: 500 }
    );
  }
}
