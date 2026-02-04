import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - List all barcode products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const source = searchParams.get("source") || "";
    const verified = searchParams.get("verified");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { barcode: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (source) {
      where.source = source;
    }
    
    if (verified !== null && verified !== "") {
      where.verified = verified === "true";
    }

    // Get products
    const [products, total] = await Promise.all([
      prisma.barcodeProduct.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.barcodeProduct.count({ where }),
    ]);

    // Get stats
    const [totalProducts, todayScans, unverifiedCount] = await Promise.all([
      prisma.barcodeProduct.count(),
      prisma.barcodeProduct.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.barcodeProduct.count({
        where: { verified: false },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalProducts,
        todayScans,
        unverifiedCount,
      },
    });

  } catch (error: any) {
    console.error("Get barcode products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get barcode products" },
      { status: 500 }
    );
  }
}

// POST - Create new barcode product (from backoffice)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      barcode,
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
    } = body;

    if (!barcode || !name) {
      return NextResponse.json(
        { error: "Barcode and name are required" },
        { status: 400 }
      );
    }

    // Check if exists
    const existing = await prisma.barcodeProduct.findUnique({
      where: { barcode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Barcode already exists" },
        { status: 400 }
      );
    }

    const product = await prisma.barcodeProduct.create({
      data: {
        barcode,
        name,
        brand,
        imageUrl,
        servingSize: servingSize || 100,
        servingUnit: servingUnit || "g",
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        sodium,
        sugar,
        fiber,
        source: "manual",
        verified: true, // Manual entry from backoffice is verified
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
    });

  } catch (error: any) {
    console.error("Create barcode product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create barcode product" },
      { status: 500 }
    );
  }
}
