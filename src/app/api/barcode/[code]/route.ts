import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Open Food Facts API
const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org/api/v2/product";

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  serving_size?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal_serving"?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    fat_100g?: number;
    fat_serving?: number;
    sodium_100g?: number;
    sodium_serving?: number;
    sugars_100g?: number;
    sugars_serving?: number;
    fiber_100g?: number;
    fiber_serving?: number;
  };
}

function parseServingSize(servingSize?: string): { size: number; unit: string } {
  if (!servingSize) return { size: 100, unit: "g" };
  
  const match = servingSize.match(/(\d+(?:\.\d+)?)\s*(g|ml|ก\.?|มล\.?)?/i);
  if (match) {
    return {
      size: parseFloat(match[1]),
      unit: match[2]?.toLowerCase().replace(".", "") || "g",
    };
  }
  return { size: 100, unit: "g" };
}

function mapOpenFoodFactsToProduct(data: OpenFoodFactsProduct, barcode: string) {
  const nutriments = data.nutriments || {};
  const serving = parseServingSize(data.serving_size);
  
  // Prefer per-serving values, fallback to per-100g
  const hasServingData = nutriments["energy-kcal_serving"] !== undefined;
  
  return {
    barcode,
    name: data.product_name || "ไม่ทราบชื่อ",
    brand: data.brands || null,
    imageUrl: data.image_url || null,
    servingSize: serving.size,
    servingUnit: serving.unit,
    calories: hasServingData 
      ? (nutriments["energy-kcal_serving"] || 0)
      : (nutriments["energy-kcal_100g"] || 0) * (serving.size / 100),
    protein: hasServingData
      ? (nutriments.proteins_serving || 0)
      : (nutriments.proteins_100g || 0) * (serving.size / 100),
    carbs: hasServingData
      ? (nutriments.carbohydrates_serving || 0)
      : (nutriments.carbohydrates_100g || 0) * (serving.size / 100),
    fat: hasServingData
      ? (nutriments.fat_serving || 0)
      : (nutriments.fat_100g || 0) * (serving.size / 100),
    sodium: hasServingData
      ? (nutriments.sodium_serving || 0) * 1000 // Convert to mg
      : (nutriments.sodium_100g || 0) * (serving.size / 100) * 1000,
    sugar: hasServingData
      ? (nutriments.sugars_serving || 0)
      : (nutriments.sugars_100g || 0) * (serving.size / 100),
    fiber: hasServingData
      ? (nutriments.fiber_serving || 0)
      : (nutriments.fiber_100g || 0) * (serving.size / 100),
    source: "openfoodfacts" as const,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: barcode } = await params;

    if (!barcode || barcode.length < 8) {
      return NextResponse.json(
        { error: "Invalid barcode" },
        { status: 400 }
      );
    }

    console.log(`🔍 Searching barcode: ${barcode}`);

    // Step 1: Search in GoodFood Database first
    let existingProduct = null;
    try {
      existingProduct = await prisma.barcodeProduct.findUnique({
        where: { barcode },
      });
    } catch (dbError: any) {
      console.error('DB Error:', dbError);
    }

    if (existingProduct) {
      console.log(`✅ Found in GoodFood DB: ${existingProduct.name}`);
      
      // Update scan count
      await prisma.barcodeProduct.update({
        where: { barcode },
        data: { scanCount: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        source: "database",
        data: existingProduct,
      });
    }

    // Step 2: Search in Open Food Facts
    console.log(`🌐 Searching Open Food Facts...`);
    
    try {
      const response = await fetch(`${OPEN_FOOD_FACTS_API}/${barcode}.json`, {
        headers: {
          "User-Agent": "GoodFood Menu App/1.0",
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.status === 1 && result.product) {
          const productData = mapOpenFoodFactsToProduct(result.product, barcode);
          
          // Validate that product has meaningful data (name AND some nutrition info)
          const hasValidName = productData.name && productData.name !== "ไม่ทราบชื่อ";
          const hasNutritionData = productData.calories > 0 || productData.protein > 0 || productData.carbs > 0;
          
          if (hasValidName || hasNutritionData) {
            console.log(`✅ Found in Open Food Facts: ${productData.name}`);

            return NextResponse.json({
              success: true,
              source: "openfoodfacts",
              data: productData,
              // Flag to indicate this should be saved after user confirms
              needsSave: true,
            });
          } else {
            console.log(`⚠️ Open Food Facts has product but no useful data`);
          }
        }
      }
    } catch (offError) {
      console.log(`⚠️ Open Food Facts error:`, offError);
    }

    // Step 3: Not found anywhere
    console.log(`❌ Barcode not found: ${barcode}`);
    
    return NextResponse.json({
      success: false,
      source: "not_found",
      barcode,
      message: "ไม่พบข้อมูลสินค้านี้ กรุณาถ่ายรูปตารางโภชนาการ",
    });

  } catch (error: any) {
    console.error("Barcode search error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search barcode" },
      { status: 500 }
    );
  }
}

// POST - Save new barcode product to database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: barcode } = await params;
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
      source,
      memberId,
    } = body;

    if (!name || calories === undefined) {
      return NextResponse.json(
        { error: "Name and calories are required" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.barcodeProduct.findUnique({
      where: { barcode },
    });

    if (existing) {
      // Update existing
      const updated = await prisma.barcodeProduct.update({
        where: { barcode },
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
          source: source || "manual",
          scanCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        action: "updated",
        data: updated,
      });
    }

    // Create new
    const newProduct = await prisma.barcodeProduct.create({
      data: {
        barcode,
        name,
        brand,
        imageUrl,
        servingSize: servingSize || 100,
        servingUnit: servingUnit || "g",
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        sodium,
        sugar,
        fiber,
        source: source || "manual",
        createdById: memberId,
      },
    });

    console.log(`✅ Saved new barcode product: ${name}`);

    return NextResponse.json({
      success: true,
      action: "created",
      data: newProduct,
    });

  } catch (error: any) {
    console.error("Save barcode product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save barcode product" },
      { status: 500 }
    );
  }
}
