import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { pushMessage, createOrderFlexMessage, createOrderConfirmedFlexMessage } from "@/lib/line";

// สร้างเลข Order
function generateOrderNumber() {
  const date = new Date();
  const prefix = "GF";
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${year}${month}${day}${random}`;
}

// GET - ดึงรายการ Order
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");
    const lineUserId = searchParams.get("lineUserId");

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    
    // If lineUserId is provided, filter by member
    if (lineUserId) {
      const member = await prisma.member.findUnique({
        where: { lineUserId },
      });
      if (member) {
        where.memberId = member.id;
      } else {
        return NextResponse.json([]);
      }
    }

    const orders = await prisma.order.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit) : undefined,
      include: {
        items: {
          include: {
            food: true,
          },
        },
        member: {
          select: {
            id: true,
            lineUserId: true,
            displayName: true,
            pictureUrl: true,
            phone: true,
            email: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// POST - สร้าง Order ใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      coursePlan, 
      totalDays, 
      items, 
      totalPrice, 
      memberId, 
      lineUserId, 
      note,
      discount,
      discountType,
      discountValue,
      packageName,
      finalPrice,
      restaurantId,
      deliveryFee,
      addressId, // ที่อยู่จัดส่ง
    } = body;

    // Allow orders without items for premium upgrades
    const isPremiumUpgrade = coursePlan === "PREMIUM_UPGRADE";
    if (!isPremiumUpgrade && (!items || items.length === 0)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get memberId from lineUserId if provided
    let finalMemberId = memberId || null;
    if (lineUserId && !memberId) {
      const member = await prisma.member.findUnique({
        where: { lineUserId },
      });
      if (member) {
        finalMemberId = member.id;
      }
    }

    // Get restaurant info for Flex message
    let restaurantName: string | null = null;
    if (restaurantId) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { name: true },
      });
      restaurantName = restaurant?.name || null;
    }

    // Get address info and create snapshot
    let deliveryName: string | null = null;
    let deliveryPhone: string | null = null;
    let deliveryAddress: string | null = null;
    
    if (addressId) {
      const address = await prisma.address.findUnique({
        where: { id: addressId },
      });
      if (address) {
        deliveryName = address.name;
        deliveryPhone = address.phone;
        // สร้างที่อยู่เต็ม
        const addressParts = [
          address.address,
          address.subDistrict ? `แขวง/ตำบล ${address.subDistrict}` : null,
          address.district ? `เขต/อำเภอ ${address.district}` : null,
          address.province,
          address.postalCode,
        ].filter(Boolean);
        deliveryAddress = addressParts.join(" ");
      }
    }

    // #region agent log
    console.log("[DEBUG] Creating order, isPremiumUpgrade:", isPremiumUpgrade, "items:", JSON.stringify(items));
    // #endregion

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        coursePlan: coursePlan || "single",
        totalDays: totalDays || 1,
        totalPrice: totalPrice || 0,
        deliveryFee: deliveryFee || 0,
        discount: discount || 0,
        discountType: discountType || null,
        discountValue: discountValue || null,
        packageName: packageName || null,
        finalPrice: finalPrice || totalPrice || 0,
        memberId: finalMemberId,
        restaurantId: restaurantId || null,
        addressId: addressId || null,
        deliveryName,
        deliveryPhone,
        deliveryAddress,
        note: note || null,
        // Set status to "confirmed" for premium upgrades
        ...(isPremiumUpgrade ? { status: "confirmed" } : {}),
        // Only create items if not a premium upgrade and items exist
        ...(isPremiumUpgrade || !items || items.length === 0 ? {} : {
          items: {
            create: items.map((item: {
              foodId: string;
              foodName: string;
              quantity: number;
              dayNumber?: number;
              mealType?: string;
              price: number;
              calories?: number;
            }) => ({
              foodId: item.foodId,
              foodName: item.foodName,
              quantity: item.quantity || 1,
              dayNumber: item.dayNumber || null,
              mealType: item.mealType || null,
              price: item.price || 0,
              calories: item.calories || null,
            })),
          },
        }),
      },
      include: {
        items: true,
        member: true,
      },
    });

    // ส่ง LINE Flex Message ยืนยัน Order ให้ลูกค้า
    // #region agent log
    let lineMessageStatus = "skipped";
    let lineMessageError: string | null = null;
    // #endregion
    if (lineUserId) {
      try {
        let flexMessage;
        
        if (isPremiumUpgrade) {
          flexMessage = createOrderConfirmedFlexMessage(
            order.orderNumber,
            order.finalPrice || order.totalPrice,
            undefined,
            order.id
          );
        } else {
          flexMessage = createOrderFlexMessage({
            orderNumber: order.orderNumber,
            totalPrice: order.totalPrice,
            totalDays: order.totalDays || 1,
            coursePlan: order.coursePlan || "single",
            items: order.items.map((item) => ({
              foodName: item.foodName,
              quantity: item.quantity,
              price: item.price,
            })),
            status: order.status,
            discount: order.discount || 0,
            packageName: order.packageName || null,
            finalPrice: order.finalPrice || order.totalPrice,
            restaurantName: restaurantName,
            deliveryFee: order.deliveryFee || 0,
            deliveryName: order.deliveryName,
            deliveryPhone: order.deliveryPhone,
            deliveryAddress: order.deliveryAddress,
          });
        }

        // #region agent log
        console.log("[DEBUG-FLEX] lineUserId:", lineUserId, "flexMessage altText:", flexMessage?.altText, "flexType:", flexMessage?.type);
        // #endregion
        const pushResult = await pushMessage(lineUserId, [flexMessage]);
        // #region agent log
        lineMessageStatus = pushResult ? "sent" : "failed";
        console.log("[DEBUG-FLEX] pushResult:", pushResult, "lineMessageStatus:", lineMessageStatus);
        // #endregion
      } catch (error) {
        // #region agent log
        lineMessageStatus = "error";
        lineMessageError = error instanceof Error ? error.message : String(error);
        console.error("[DEBUG-FLEX] Failed to send LINE order confirmation:", error);
        // #endregion
      }
    } else {
      // #region agent log
      console.log("[DEBUG-FLEX] No lineUserId provided, skipping LINE message");
      // #endregion
    }

    // #region agent log
    return NextResponse.json({ ...order, _debug: { lineMessageStatus, lineMessageError, lineUserId: lineUserId || null } }, { status: 201 });
    // #endregion
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
