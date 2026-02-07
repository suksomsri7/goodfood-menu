import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    // Get this month start for monthly stats
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for better performance
    const [
      // Member stats
      totalMembers,
      membersThisMonth,
      membersLastMonth,
      
      // Order stats - today
      ordersToday,
      ordersTodayRevenue,
      
      // Order stats - yesterday (for comparison)
      ordersYesterday,
      ordersYesterdayRevenue,
      
      // Order stats - this month
      ordersThisMonth,
      ordersThisMonthRevenue,
      
      // Order stats - last month (for comparison)
      ordersLastMonth,
      ordersLastMonthRevenue,
      
      // Food stats
      totalFoods,
      activeFoods,
      
      // Recent orders
      recentOrders,
      
      // Pending orders count
      pendingOrdersCount,
      
      // Conversation stats
      totalConversations,
      unreadMessages,
      recentConversations,
      
      // Order by status
      ordersByStatus,
    ] = await Promise.all([
      // Members
      prisma.member.count(),
      prisma.member.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.member.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } }),
      
      // Orders today
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { finalPrice: true },
      }),
      
      // Orders yesterday
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { finalPrice: true },
      }),
      
      // Orders this month
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { finalPrice: true },
      }),
      
      // Orders last month
      prisma.order.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } },
        _sum: { finalPrice: true },
      }),
      
      // Foods
      prisma.food.count(),
      prisma.food.count({ where: { isActive: true } }),
      
      // Recent orders with details
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          member: { select: { displayName: true, pictureUrl: true } },
          items: { select: { quantity: true } },
        },
      }),
      
      // Pending orders
      prisma.order.count({ where: { status: "pending" } }),
      
      // Conversations
      prisma.lineConversation.count({ where: { isActive: true } }),
      prisma.lineConversation.aggregate({
        where: { isActive: true },
        _sum: { unreadCount: true },
      }),
      prisma.lineConversation.findMany({
        where: { isActive: true },
        take: 5,
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      
      // Orders by status
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    // Calculate changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const todayRevenue = ordersTodayRevenue._sum.finalPrice || 0;
    const yesterdayRevenue = ordersYesterdayRevenue._sum.finalPrice || 0;
    const thisMonthRevenue = ordersThisMonthRevenue._sum.finalPrice || 0;
    const lastMonthRevenueVal = ordersLastMonthRevenue._sum.finalPrice || 0;

    // Format recent orders
    const formattedRecentOrders = recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.member?.displayName || "ไม่ระบุชื่อ",
      customerImage: order.member?.pictureUrl || null,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      total: order.finalPrice || order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
    }));

    // Format recent conversations
    const formattedConversations = recentConversations.map((conv) => ({
      id: conv.id,
      name: conv.displayName || "Unknown",
      pictureUrl: conv.pictureUrl,
      lastMessage: conv.messages[0]?.content || "",
      lastMessageAt: conv.lastMessageAt,
      unreadCount: conv.unreadCount,
    }));

    // Format orders by status
    const statusCounts: Record<string, number> = {};
    ordersByStatus.forEach((item) => {
      statusCounts[item.status] = item._count;
    });

    return NextResponse.json({
      stats: {
        members: {
          total: totalMembers,
          thisMonth: membersThisMonth,
          change: calculateChange(membersThisMonth, membersLastMonth),
        },
        ordersToday: {
          count: ordersToday,
          change: calculateChange(ordersToday, ordersYesterday),
        },
        ordersThisMonth: {
          count: ordersThisMonth,
          change: calculateChange(ordersThisMonth, ordersLastMonth),
        },
        revenue: {
          today: todayRevenue,
          todayChange: calculateChange(todayRevenue, yesterdayRevenue),
          thisMonth: thisMonthRevenue,
          monthChange: calculateChange(thisMonthRevenue, lastMonthRevenueVal),
        },
        foods: {
          total: totalFoods,
          active: activeFoods,
        },
        pendingOrders: pendingOrdersCount,
        messages: {
          totalConversations,
          unreadCount: unreadMessages._sum.unreadCount || 0,
        },
        ordersByStatus: statusCounts,
      },
      recentOrders: formattedRecentOrders,
      recentConversations: formattedConversations,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
