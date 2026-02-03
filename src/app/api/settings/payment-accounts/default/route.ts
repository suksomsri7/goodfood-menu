import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET - ดึงบัญชีหลัก (default)
export async function GET() {
  try {
    const account = await prisma.paymentAccount.findFirst({
      where: {
        isActive: true,
        isDefault: true,
      },
    });

    // If no default, get first active account
    if (!account) {
      const firstAccount = await prisma.paymentAccount.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(firstAccount);
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error fetching default payment account:", error);
    return NextResponse.json(
      { error: "Failed to fetch default payment account" },
      { status: 500 }
    );
  }
}
