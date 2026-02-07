import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// GET - List all staff
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const roleId = searchParams.get("roleId");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (roleId) {
      where.roleId = roleId;
    }

    const staff = await prisma.staff.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Don't return password
    const safeStaff = staff.map(({ password: _password, ...rest }) => rest);

    return NextResponse.json(safeStaff);
  } catch (error) {
    console.error("Error fetching staff:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    );
  }
}

// POST - Create new staff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, phone, avatarUrl, roleId } = body;

    // Validate required fields
    if (!email || !password || !name || !roleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingStaff = await prisma.staff.findUnique({
      where: { email },
    });

    if (existingStaff) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const staff = await prisma.staff.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        avatarUrl,
        roleId,
      },
      include: {
        role: true,
      },
    });

    // Don't return password
    const { password: _password, ...safeStaff } = staff;

    return NextResponse.json(safeStaff, { status: 201 });
  } catch (error) {
    console.error("Error creating staff:", error);
    return NextResponse.json(
      { error: "Failed to create staff" },
      { status: 500 }
    );
  }
}
