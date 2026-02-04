import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get single barcode product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.barcodeProduct.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });

  } catch (error: any) {
    console.error("Get barcode product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get barcode product" },
      { status: 500 }
    );
  }
}

// PUT - Update barcode product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      brand,
      imageUrl,
      servingSize,
      servingUnit,
      calories,
      protein,
      carbs,
      fat,
      sodium,
      sugar,
      fiber,
      verified,
    } = body;

    const product = await prisma.barcodeProduct.update({
      where: { id },
      data: {
        name,
        brand,
        imageUrl,
        servingSize,
        servingUnit,
        calories,
        protein,
        carbs,
        fat,
        sodium,
        sugar,
        fiber,
        verified,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
    });

  } catch (error: any) {
    console.error("Update barcode product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update barcode product" },
      { status: 500 }
    );
  }
}

// DELETE - Delete barcode product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.barcodeProduct.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Product deleted",
    });

  } catch (error: any) {
    console.error("Delete barcode product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete barcode product" },
      { status: 500 }
    );
  }
}
