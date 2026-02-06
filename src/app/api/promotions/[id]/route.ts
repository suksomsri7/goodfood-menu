import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadToBunny, deleteFromBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงโปรโมชั่นตาม ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promotion = await prisma.promotion.findUnique({
      where: { id },
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

    if (!promotion) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(promotion);
  } catch (error) {
    console.error("Error fetching promotion:", error);
    return NextResponse.json(
      { error: "Failed to fetch promotion" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทโปรโมชั่น
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      imageUrl,
      type,
      discountType,
      discountValue,
      minQuantity,
      minAmount,
      startDate,
      endDate,
      restaurantId,
      isActive,
      items,
      gifts,
    } = body;

    // ดึงข้อมูลเดิม
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 }
      );
    }

    // Handle image upload/delete
    let finalImageUrl = imageUrl;
    if (imageUrl !== undefined) {
      if (imageUrl && isBase64Image(imageUrl)) {
        // ลบรูปเก่าและอัพโหลดรูปใหม่
        if (existing.imageUrl) {
          await deleteFromBunny(existing.imageUrl);
        }
        finalImageUrl = await uploadToBunny(imageUrl, "promotions", "promo.jpg");
      } else if (!imageUrl && existing.imageUrl) {
        // ลบรูปเก่า
        await deleteFromBunny(existing.imageUrl);
        finalImageUrl = null;
      }
    }

    // ถ้ามีการอัพเดท items/gifts ให้ลบของเก่าก่อน
    if (items !== undefined) {
      await prisma.promotionItem.deleteMany({
        where: { promotionId: id },
      });
    }
    if (gifts !== undefined) {
      await prisma.promotionGift.deleteMany({
        where: { promotionId: id },
      });
    }

    const updatedPromotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(finalImageUrl !== undefined && { imageUrl: finalImageUrl }),
        ...(type !== undefined && { type }),
        ...(discountType !== undefined && { discountType }),
        ...(discountValue !== undefined && {
          discountValue: discountValue ? parseFloat(discountValue) : null,
        }),
        ...(minQuantity !== undefined && {
          minQuantity: minQuantity ? parseInt(minQuantity) : 1,
        }),
        ...(minAmount !== undefined && {
          minAmount: minAmount ? parseFloat(minAmount) : null,
        }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
        ...(restaurantId !== undefined && { restaurantId: restaurantId || null }),
        ...(isActive !== undefined && { isActive }),
        ...(items !== undefined && {
          items: {
            create: items.map((item: { foodId: string; quantity: number }) => ({
              foodId: item.foodId,
              quantity: item.quantity || 1,
            })),
          },
        }),
        ...(gifts !== undefined && {
          gifts: {
            create: gifts.map((gift: { foodId: string; quantity: number }) => ({
              foodId: gift.foodId,
              quantity: gift.quantity || 1,
            })),
          },
        }),
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
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

    return NextResponse.json(updatedPromotion);
  } catch (error) {
    console.error("Error updating promotion:", error);
    return NextResponse.json(
      { error: "Failed to update promotion" },
      { status: 500 }
    );
  }
}

// DELETE - ลบโปรโมชั่น
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // ดึงข้อมูลเดิมเพื่อลบรูป
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (existing?.imageUrl) {
      await deleteFromBunny(existing.imageUrl);
    }
    
    await prisma.promotion.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    return NextResponse.json(
      { error: "Failed to delete promotion" },
      { status: 500 }
    );
  }
}
