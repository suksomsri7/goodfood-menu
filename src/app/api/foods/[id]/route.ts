import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { 
  uploadToBunny, 
  uploadMultipleToBunny, 
  deleteFromBunny, 
  deleteMultipleFromBunny,
  isBase64Image 
} from "@/lib/bunny";

// GET - ดึงเมนูอาหารตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const food = await prisma.food.findUnique({
      where: { id },
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

    if (!food) {
      return NextResponse.json(
        { error: "Food not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(food);
  } catch (error) {
    console.error("Error fetching food:", error);
    return NextResponse.json(
      { error: "Failed to fetch food" },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทเมนูอาหารทั้งหมด
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      isActive,
    } = body;

    // ตรวจสอบว่ามี food อยู่หรือไม่
    const existing = await prisma.food.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Food not found" },
        { status: 404 }
      );
    }

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

    // Handle main image
    let finalImageUrl = imageUrl || null;
    if (imageUrl && isBase64Image(imageUrl)) {
      // ลบรูปเก่าถ้ามี
      if (existing.imageUrl) {
        await deleteFromBunny(existing.imageUrl);
      }
      // อัพโหลดรูปใหม่
      finalImageUrl = await uploadToBunny(imageUrl, "foods", "main.jpg");
    } else if (!imageUrl && existing.imageUrl) {
      // ถ้าไม่มีรูปใหม่และต้องการลบรูปเก่า
      await deleteFromBunny(existing.imageUrl);
      finalImageUrl = null;
    }

    // Handle additional images
    let finalImages: string[] = [];
    if (images !== undefined) {
      const existingImages = existing.images || [];
      const newImages = images || [];
      
      // หารูปที่ถูกลบออก
      const removedImages = existingImages.filter((img: string) => !newImages.includes(img));
      if (removedImages.length > 0) {
        await deleteMultipleFromBunny(removedImages);
      }
      
      // แยกรูปใหม่ที่เป็น base64
      const base64Images = newImages.filter((img: string) => isBase64Image(img));
      const urlImages = newImages.filter((img: string) => !isBase64Image(img));
      
      if (base64Images.length > 0) {
        const uploadedUrls = await uploadMultipleToBunny(base64Images, "foods");
        finalImages = [...urlImages, ...uploadedUrls];
      } else {
        finalImages = urlImages;
      }
    } else {
      finalImages = existing.images || [];
    }

    const food = await prisma.food.update({
      where: { id },
      data: {
        name,
        description: description || null,
        ingredients: ingredients || existing.ingredients || [],
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
        warning: warning !== undefined ? (warning || null) : existing.warning,
        categoryId,
        isActive: isActive !== undefined ? isActive : existing.isActive,
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

    return NextResponse.json(food);
  } catch (error) {
    console.error("Error updating food:", error);
    return NextResponse.json(
      { error: "Failed to update food" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทบางฟิลด์ของเมนูอาหาร
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // ตรวจสอบว่ามี food อยู่หรือไม่
    const existing = await prisma.food.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Food not found" },
        { status: 404 }
      );
    }

    // ถ้ามี categoryId ให้ตรวจสอบว่ามีจริง
    if (body.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 400 }
        );
      }
    }

    // แปลงข้อมูลตัวเลข
    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    
    // Handle imageUrl with Bunny CDN
    if (body.imageUrl !== undefined) {
      if (body.imageUrl && isBase64Image(body.imageUrl)) {
        // ลบรูปเก่าและอัพโหลดรูปใหม่
        if (existing.imageUrl) {
          await deleteFromBunny(existing.imageUrl);
        }
        updateData.imageUrl = await uploadToBunny(body.imageUrl, "foods", "main.jpg");
      } else if (!body.imageUrl && existing.imageUrl) {
        // ลบรูปเก่า
        await deleteFromBunny(existing.imageUrl);
        updateData.imageUrl = null;
      } else {
        updateData.imageUrl = body.imageUrl || null;
      }
    }

    // Handle additional images
    if (body.images !== undefined) {
      const existingImages = existing.images || [];
      const newImages = body.images || [];
      
      // หารูปที่ถูกลบออก
      const removedImages = existingImages.filter((img: string) => !newImages.includes(img));
      if (removedImages.length > 0) {
        await deleteMultipleFromBunny(removedImages);
      }
      
      // แยกรูปใหม่ที่เป็น base64
      const base64Images = newImages.filter((img: string) => isBase64Image(img));
      const urlImages = newImages.filter((img: string) => !isBase64Image(img));
      
      if (base64Images.length > 0) {
        const uploadedUrls = await uploadMultipleToBunny(base64Images, "foods");
        updateData.images = [...urlImages, ...uploadedUrls];
      } else {
        updateData.images = urlImages;
      }
    }

    if (body.ingredients !== undefined) updateData.ingredients = body.ingredients || [];
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.discountPrice !== undefined) updateData.discountPrice = body.discountPrice ? parseFloat(body.discountPrice) : null;
    if (body.badge !== undefined) updateData.badge = body.badge || null;
    if (body.calories !== undefined) updateData.calories = parseFloat(body.calories);
    if (body.protein !== undefined) updateData.protein = parseFloat(body.protein);
    if (body.carbs !== undefined) updateData.carbs = parseFloat(body.carbs);
    if (body.fat !== undefined) updateData.fat = parseFloat(body.fat);
    if (body.fiber !== undefined) updateData.fiber = body.fiber ? parseFloat(body.fiber) : null;
    if (body.sugar !== undefined) updateData.sugar = body.sugar ? parseFloat(body.sugar) : null;
    if (body.sodium !== undefined) updateData.sodium = body.sodium ? parseFloat(body.sodium) : null;
    if (body.servingSize !== undefined) updateData.servingSize = body.servingSize ? parseFloat(body.servingSize) : null;
    if (body.servingUnit !== undefined) updateData.servingUnit = body.servingUnit || null;
    if (body.warning !== undefined) updateData.warning = body.warning || null;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const food = await prisma.food.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(food);
  } catch (error) {
    console.error("Error patching food:", error);
    return NextResponse.json(
      { error: "Failed to update food" },
      { status: 500 }
    );
  }
}

// DELETE - ลบเมนูอาหาร
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ตรวจสอบว่ามี food อยู่หรือไม่
    const existing = await prisma.food.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Food not found" },
        { status: 404 }
      );
    }

    // ลบรูปภาพจาก Bunny CDN
    if (existing.imageUrl) {
      await deleteFromBunny(existing.imageUrl);
    }
    if (existing.images && existing.images.length > 0) {
      await deleteMultipleFromBunny(existing.images);
    }

    await prisma.food.delete({ where: { id } });

    return NextResponse.json({ message: "Food deleted successfully" });
  } catch (error) {
    console.error("Error deleting food:", error);
    return NextResponse.json(
      { error: "Failed to delete food" },
      { status: 500 }
    );
  }
}
