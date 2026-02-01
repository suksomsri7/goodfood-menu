import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadToBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงรายการโปรโมชั่นทั้งหมด
export async function GET() {
  try {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            food: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
        gifts: {
          include: {
            food: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(promotions);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return NextResponse.json(
      { error: "Failed to fetch promotions" },
      { status: 500 }
    );
  }
}

// POST - สร้างโปรโมชั่นใหม่
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      imageUrl,
      type,
      discountType,
      discountValue,
      startDate,
      endDate,
      items,
      gifts,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // Upload image to Bunny CDN if it's base64
    let finalImageUrl = imageUrl || null;
    if (imageUrl && isBase64Image(imageUrl)) {
      try {
        finalImageUrl = await uploadToBunny(imageUrl, "promotions", "promo.jpg");
      } catch (uploadError) {
        console.error("Failed to upload promotion image:", uploadError);
      }
    }

    const newPromotion = await prisma.promotion.create({
      data: {
        name,
        description,
        imageUrl: finalImageUrl,
        type,
        discountType,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        items: {
          create: items?.map((item: { foodId: string; quantity: number }) => ({
            foodId: item.foodId,
            quantity: item.quantity || 1,
          })) || [],
        },
        gifts: {
          create: gifts?.map((gift: { foodId: string; quantity: number }) => ({
            foodId: gift.foodId,
            quantity: gift.quantity || 1,
          })) || [],
        },
      },
      include: {
        items: {
          include: {
            food: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
        gifts: {
          include: {
            food: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(newPromotion, { status: 201 });
  } catch (error) {
    console.error("Error creating promotion:", error);
    return NextResponse.json(
      { error: "Failed to create promotion" },
      { status: 500 }
    );
  }
}
