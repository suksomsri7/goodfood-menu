import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE - Delete a meal log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.mealLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete meal:", error);
    return NextResponse.json(
      { error: "Failed to delete meal" },
      { status: 500 }
    );
  }
}

// PATCH - Update a meal log
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const meal = await prisma.mealLog.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(meal);
  } catch (error) {
    console.error("Failed to update meal:", error);
    return NextResponse.json(
      { error: "Failed to update meal" },
      { status: 500 }
    );
  }
}
