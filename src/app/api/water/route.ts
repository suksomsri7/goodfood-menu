import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get water logs for a user on a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD (local date from client)
    const tzOffsetStr = searchParams.get("tzOffset"); // Client timezone offset in minutes

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Build date filter with timezone awareness
    let dateFilter = {};
    if (dateStr) {
      const tzOffset = tzOffsetStr ? parseInt(tzOffsetStr, 10) : 0;
      const [year, month, day] = dateStr.split('-').map(Number);
      
      const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      startOfDayUTC.setUTCMinutes(startOfDayUTC.getUTCMinutes() + tzOffset);
      
      const endOfDayUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      endOfDayUTC.setUTCMinutes(endOfDayUTC.getUTCMinutes() + tzOffset);
      
      dateFilter = {
        date: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
      };
    }

    const waterLogs = await prisma.waterLog.findMany({
      where: {
        memberId: member.id,
        ...dateFilter,
      },
      orderBy: { date: "desc" },
    });

    // Calculate total
    const total = waterLogs.reduce((sum, log) => sum + log.amount, 0);

    return NextResponse.json({ logs: waterLogs, total });
  } catch (error) {
    console.error("Failed to get water logs:", error);
    return NextResponse.json(
      { error: "Failed to get water logs" },
      { status: 500 }
    );
  }
}

// POST - Add a water log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, amount, date } = body;

    if (!lineUserId || amount === undefined) {
      return NextResponse.json(
        { error: "lineUserId and amount are required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const waterLog = await prisma.waterLog.create({
      data: {
        memberId: member.id,
        amount,
        date: date ? new Date(date) : new Date(),
      },
    });

    return NextResponse.json(waterLog);
  } catch (error) {
    console.error("Failed to add water log:", error);
    return NextResponse.json(
      { error: "Failed to add water log" },
      { status: 500 }
    );
  }
}
