import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get weight logs for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const days = parseInt(searchParams.get("days") || "14");

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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const weightLogs = await prisma.weightLog.findMany({
      where: {
        memberId: member.id,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(weightLogs);
  } catch (error) {
    console.error("Failed to get weight logs:", error);
    return NextResponse.json(
      { error: "Failed to get weight logs" },
      { status: 500 }
    );
  }
}

// POST - Add a weight log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, weight, note, date } = body;

    if (!lineUserId || weight === undefined) {
      return NextResponse.json(
        { error: "lineUserId and weight are required" },
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

    // Create weight log
    const weightLog = await prisma.weightLog.create({
      data: {
        memberId: member.id,
        weight,
        note,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Update member's current weight
    await prisma.member.update({
      where: { id: member.id },
      data: { weight },
    });

    return NextResponse.json(weightLog);
  } catch (error) {
    console.error("Failed to add weight log:", error);
    return NextResponse.json(
      { error: "Failed to add weight log" },
      { status: 500 }
    );
  }
}
