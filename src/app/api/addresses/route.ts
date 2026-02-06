import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - ดึงรายการที่อยู่ของ member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

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
      return NextResponse.json([]);
    }

    const addresses = await prisma.address.findMany({
      where: { 
        memberId: member.id,
        isActive: true,
      },
      orderBy: [
        { isDefault: "desc" }, // ที่อยู่หลักมาก่อน
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(addresses);
  } catch (error) {
    console.error("Failed to get addresses:", error);
    return NextResponse.json(
      { error: "Failed to get addresses" },
      { status: 500 }
    );
  }
}

// POST - เพิ่มที่อยู่ใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lineUserId,
      label,
      name,
      phone,
      address,
      subDistrict,
      district,
      province,
      postalCode,
      note,
      isDefault,
    } = body;

    if (!lineUserId || !name || !phone || !address || !province || !postalCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create member
    let member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      member = await prisma.member.create({
        data: { lineUserId },
      });
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.address.updateMany({
        where: { memberId: member.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if this is the first address - set as default
    const existingCount = await prisma.address.count({
      where: { memberId: member.id, isActive: true },
    });

    const newAddress = await prisma.address.create({
      data: {
        memberId: member.id,
        label: label || null,
        name,
        phone,
        address,
        subDistrict: subDistrict || null,
        district: district || null,
        province,
        postalCode,
        note: note || null,
        isDefault: isDefault || existingCount === 0, // First address is default
      },
    });

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    console.error("Failed to create address:", error);
    return NextResponse.json(
      { error: "Failed to create address" },
      { status: 500 }
    );
  }
}

// PATCH - แก้ไขที่อยู่
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      lineUserId,
      label,
      name,
      phone,
      address,
      subDistrict,
      district,
      province,
      postalCode,
      note,
      isDefault,
    } = body;

    if (!id || !lineUserId) {
      return NextResponse.json(
        { error: "id and lineUserId are required" },
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

    // Verify address belongs to member
    const existingAddress = await prisma.address.findFirst({
      where: { id, memberId: member.id },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.address.updateMany({
        where: { memberId: member.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        label: label !== undefined ? label : undefined,
        name: name !== undefined ? name : undefined,
        phone: phone !== undefined ? phone : undefined,
        address: address !== undefined ? address : undefined,
        subDistrict: subDistrict !== undefined ? subDistrict : undefined,
        district: district !== undefined ? district : undefined,
        province: province !== undefined ? province : undefined,
        postalCode: postalCode !== undefined ? postalCode : undefined,
        note: note !== undefined ? note : undefined,
        isDefault: isDefault !== undefined ? isDefault : undefined,
      },
    });

    return NextResponse.json(updatedAddress);
  } catch (error) {
    console.error("Failed to update address:", error);
    return NextResponse.json(
      { error: "Failed to update address" },
      { status: 500 }
    );
  }
}

// DELETE - ลบที่อยู่ (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const lineUserId = searchParams.get("lineUserId");

    if (!id || !lineUserId) {
      return NextResponse.json(
        { error: "id and lineUserId are required" },
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

    // Verify address belongs to member
    const existingAddress = await prisma.address.findFirst({
      where: { id, memberId: member.id },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.address.update({
      where: { id },
      data: { isActive: false },
    });

    // If deleted address was default, set another as default
    if (existingAddress.isDefault) {
      const firstActive = await prisma.address.findFirst({
        where: { memberId: member.id, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      if (firstActive) {
        await prisma.address.update({
          where: { id: firstActive.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete address:", error);
    return NextResponse.json(
      { error: "Failed to delete address" },
      { status: 500 }
    );
  }
}
