import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get member progress photos
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
      include: {
        progressPhotos: {
          orderBy: { weekNumber: "asc" },
        },
        weightLogs: {
          orderBy: { date: "desc" },
          take: 10,
        },
        memberType: {
          select: {
            courseDuration: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Calculate weeks in course
    const totalWeeks = member.memberType 
      ? Math.ceil(member.memberType.courseDuration / 7) 
      : 4;

    // Map photos by week
    const photosByWeek: Record<number, typeof member.progressPhotos[0] | null> = {};
    for (let i = 1; i <= totalWeeks; i++) {
      photosByWeek[i] = member.progressPhotos.find(p => p.weekNumber === i) || null;
    }

    // Get weight at course start and current
    const startWeight = member.weight;
    const currentWeight = member.weightLogs[0]?.weight || member.weight;
    const weightChange = startWeight && currentWeight ? currentWeight - startWeight : null;

    return NextResponse.json({
      photos: member.progressPhotos,
      photosByWeek,
      totalWeeks,
      weights: {
        start: startWeight,
        current: currentWeight,
        change: weightChange,
      },
      courseStartDate: member.courseStartDate,
    });
  } catch (error) {
    console.error("Error getting progress photos:", error);
    return NextResponse.json(
      { error: "Failed to get progress photos" },
      { status: 500 }
    );
  }
}

// POST - Add new progress photo
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { imageUrl, weight, note } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
      include: {
        memberType: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Calculate week number
    let weekNumber = 1;
    if (member.courseStartDate) {
      const daysSinceStart = Math.floor(
        (Date.now() - member.courseStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      weekNumber = Math.floor(daysSinceStart / 7) + 1;
    }

    // Check if photo already exists for this week
    const existingPhoto = await prisma.progressPhoto.findFirst({
      where: {
        memberId: member.id,
        weekNumber,
      },
    });

    let photo;
    if (existingPhoto) {
      // Update existing photo
      photo = await prisma.progressPhoto.update({
        where: { id: existingPhoto.id },
        data: {
          imageUrl,
          weight: weight || null,
          note: note || null,
          takenAt: new Date(),
        },
      });
    } else {
      // Create new photo
      photo = await prisma.progressPhoto.create({
        data: {
          memberId: member.id,
          imageUrl,
          weight: weight || null,
          weekNumber,
          note: note || null,
        },
      });
    }

    // Also log weight if provided
    if (weight) {
      await prisma.weightLog.create({
        data: {
          memberId: member.id,
          weight,
          note: `Progress photo week ${weekNumber}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      photo,
    });
  } catch (error) {
    console.error("Error creating progress photo:", error);
    return NextResponse.json(
      { error: "Failed to create progress photo" },
      { status: 500 }
    );
  }
}

// DELETE - Delete progress photo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");
    const lineUserId = searchParams.get("lineUserId");

    if (!photoId || !lineUserId) {
      return NextResponse.json(
        { error: "photoId and lineUserId are required" },
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

    // Verify photo belongs to member
    const photo = await prisma.progressPhoto.findFirst({
      where: {
        id: photoId,
        memberId: member.id,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    await prisma.progressPhoto.delete({
      where: { id: photoId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting progress photo:", error);
    return NextResponse.json(
      { error: "Failed to delete progress photo" },
      { status: 500 }
    );
  }
}
