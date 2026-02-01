import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadToBunny, deleteFromBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงแพ็คเกจตาม ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pkg = await prisma.package.findUnique({
      where: { id },
    });

    if (!pkg) {
      return NextResponse.json(
        { error: "Package not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(pkg);
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทแพ็คเกจทั้งหมด
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, requiredItems, discountType, discountValue, imageUrl } = body;

    // ดึงข้อมูลเดิม
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Package not found" },
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
        finalImageUrl = await uploadToBunny(imageUrl, "packages", "package.jpg");
      } else if (!imageUrl && existing.imageUrl) {
        // ลบรูปเก่า
        await deleteFromBunny(existing.imageUrl);
        finalImageUrl = null;
      }
    }

    const updatedPackage = await prisma.package.update({
      where: { id },
      data: {
        name,
        description: description || null,
        requiredItems: parseInt(requiredItems) || 1,
        discountType: discountType || "percent",
        discountValue: parseFloat(discountValue) || 0,
        imageUrl: finalImageUrl,
      },
    });

    return NextResponse.json(updatedPackage);
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทบางฟิลด์ของแพ็คเกจ
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // ดึงข้อมูลเดิม
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Package not found" },
        { status: 404 }
      );
    }

    // Handle image upload/delete
    let finalImageUrl = body.imageUrl;
    if (body.imageUrl !== undefined) {
      if (body.imageUrl && isBase64Image(body.imageUrl)) {
        // ลบรูปเก่าและอัพโหลดรูปใหม่
        if (existing.imageUrl) {
          await deleteFromBunny(existing.imageUrl);
        }
        finalImageUrl = await uploadToBunny(body.imageUrl, "packages", "package.jpg");
      } else if (!body.imageUrl && existing.imageUrl) {
        // ลบรูปเก่า
        await deleteFromBunny(existing.imageUrl);
        finalImageUrl = null;
      }
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.requiredItems !== undefined) updateData.requiredItems = parseInt(body.requiredItems) || 1;
    if (body.discountType !== undefined) updateData.discountType = body.discountType;
    if (body.discountValue !== undefined) updateData.discountValue = parseFloat(body.discountValue) || 0;
    if (finalImageUrl !== undefined) updateData.imageUrl = finalImageUrl;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updatedPackage = await prisma.package.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedPackage);
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

// DELETE - ลบแพ็คเกจ
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // ดึงข้อมูลเดิมเพื่อลบรูป
    const existing = await prisma.package.findUnique({ where: { id } });
    if (existing?.imageUrl) {
      await deleteFromBunny(existing.imageUrl);
    }
    
    await prisma.package.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting package:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}
