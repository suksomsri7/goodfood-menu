import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายการสมาชิกทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get members with order count
    const [members, totalCount] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          memberType: {
            select: { id: true, name: true, color: true },
          },
          _count: {
            select: {
              orders: true,
              mealLogs: true,
            },
          },
        },
      }),
      prisma.member.count({ where }),
    ]);

    // Get AI usage count for today and total for each member
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const memberIds = members.map(m => m.id);
    
    // Get total AI usage per member
    const totalAiUsage = await prisma.aiUsageLog.groupBy({
      by: ['memberId'],
      where: { memberId: { in: memberIds } },
      _count: { id: true },
    });
    
    // Get today's AI usage per member
    const todayAiUsage = await prisma.aiUsageLog.groupBy({
      by: ['memberId'],
      where: { 
        memberId: { in: memberIds },
        createdAt: { gte: today },
      },
      _count: { id: true },
    });

    // Create lookup maps
    const totalAiUsageMap = new Map(totalAiUsage.map(u => [u.memberId, u._count.id]));
    const todayAiUsageMap = new Map(todayAiUsage.map(u => [u.memberId, u._count.id]));

    // Get today's stats (reuse today variable from above)
    
    // Use try-catch for new fields in case Prisma client not regenerated yet
    let activeToday = 0;
    let newToday = 0;
    let inactiveCount = 0;
    
    try {
      [activeToday, newToday, inactiveCount] = await Promise.all([
        // Try lastActiveAt first, fallback to updatedAt
        prisma.member.count({
          where: { lastActiveAt: { gte: today } },
        }).catch(() => prisma.member.count({ where: { updatedAt: { gte: today } } })),
        prisma.member.count({
          where: { createdAt: { gte: today } },
        }),
        prisma.member.count({
          where: { activityStatus: "inactive" },
        }).catch(() => 0), // Return 0 if field doesn't exist yet
      ]);
    } catch (statsError) {
      // Fallback to basic stats if new fields not available
      [activeToday, newToday] = await Promise.all([
        prisma.member.count({ where: { updatedAt: { gte: today } } }),
        prisma.member.count({ where: { createdAt: { gte: today } } }),
      ]);
      inactiveCount = 0;
    }

    // Calculate total orders
    const totalOrders = await prisma.order.count();

    // Format members (use optional chaining for new fields in case Prisma client not regenerated)
    const formattedMembers = members.map((member) => ({
      id: member.id,
      lineUserId: member.lineUserId,
      displayName: member.displayName,
      name: member.name,
      pictureUrl: member.pictureUrl,
      email: member.email,
      phone: member.phone,
      goalType: member.goalType,
      dailyCalories: member.dailyCalories,
      weight: member.weight,
      goalWeight: member.goalWeight,
      isOnboarded: member.isOnboarded,
      isActive: member.isActive,
      activityStatus: (member as any).activityStatus || "active",
      lastActiveAt: (member as any).lastActiveAt || member.updatedAt,
      memberType: member.memberType,
      orderCount: member._count.orders,
      mealLogCount: member._count.mealLogs,
      aiUsageTotal: totalAiUsageMap.get(member.id) || 0,
      aiUsageToday: todayAiUsageMap.get(member.id) || 0,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }));

    return NextResponse.json({
      members: formattedMembers,
      stats: {
        total: totalCount,
        activeToday,
        newToday,
        totalOrders,
        inactiveCount,
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
