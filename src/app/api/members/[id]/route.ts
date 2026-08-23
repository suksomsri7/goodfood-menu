import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/staffAuth";
import { SPICE_LABELS, thaiDate, trackLabel } from "@/lib/program";
import { AREA_TH, DAY_TH, GOAL_TH, tagTh } from "@/lib/trainingProfile";
import { EQUIPMENT_LABEL_TH } from "@/lib/memberEquipment";
import { BAND_LABEL_TH, ReadinessBand } from "@/lib/readiness";

/**
 * ข้อมูลที่สมาชิกกรอกไว้ในแอป — แอดมินต้องเห็นเพื่อคุยกับลูกค้าได้ตรงเรื่อง
 *
 * 🔴 ตัวเลขเท่านั้น ห้ามมีรูปวัดสัดส่วนโผล่มาทางนี้เด็ดขาด (ลูกค้าให้รูปไว้ให้ระบบวัด ไม่ได้ให้คนดู)
 * 🔴 ทุกก้อนพังแยกกันได้ — โปรไฟล์เทรนยังไม่มี ต้องไม่ทำให้หน้าสมาชิกทั้งหน้าโหลดไม่ขึ้น
 *    (เดิมทั้ง endpoint อยู่ใน try เดียว = ตารางใหม่ที่ยังไม่ได้ migrate จะล้มทั้งหน้า)
 */
const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
  p.catch((e) => {
    console.error("appData sub-query failed:", e);
    return fallback;
  });

/** วันที่ในตารางเหล่านี้เก็บเป็นเที่ยงคืน UTC ของวัน BKK — ฟอร์แมตด้วย thaiDate ตรง ๆ ได้เลย */
const SEVERITY_TH: Record<string, string> = { caution: "ระวัง", avoid: "เลี่ยงท่าที่กระทบ" };

// GET - ดึงรายละเอียดสมาชิก
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireStaff(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await params;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        memberType: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        weightLogs: {
          orderBy: { date: "desc" },
          take: 30,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Get AI usage statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total AI usage by type
    const totalByType = await prisma.aiUsageLog.groupBy({
      by: ['usageType'],
      where: { memberId: id },
      _count: { id: true },
    });

    // Get today's AI usage by type
    const todayByType = await prisma.aiUsageLog.groupBy({
      by: ['usageType'],
      where: { 
        memberId: id,
        createdAt: { gte: today },
      },
      _count: { id: true },
    });

    // Get recent AI usage logs (last 20)
    const recentLogs = await prisma.aiUsageLog.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Format AI usage stats
    const aiUsageStats = {
      total: totalByType.reduce((sum, t) => sum + t._count.id, 0),
      today: todayByType.reduce((sum, t) => sum + t._count.id, 0),
      byType: {
        total: Object.fromEntries(totalByType.map(t => [t.usageType, t._count.id])),
        today: Object.fromEntries(todayByType.map(t => [t.usageType, t._count.id])),
      },
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        usageType: log.usageType,
        createdAt: log.createdAt,
      })),
    };

    // ── ข้อมูลที่เก็บมาจากแอป ── (แต่ละก้อนล้มแยกกันได้ ดู comment ที่ safe())
    const now = new Date();
    const [
      foodProfile,
      trainingProfile,
      equipment,
      injuries,
      mealFeedbacks,
      readiness,
      enrollments,
    ] = await Promise.all([
      safe(prisma.foodProfile.findUnique({ where: { memberId: id } }), null),
      safe(prisma.trainingProfile.findUnique({ where: { memberId: id } }), null),
      safe(
        prisma.memberEquipment.findMany({
          where: { memberId: id },
          orderBy: { createdAt: "asc" },
          select: { id: true, type: true, minKg: true, maxKg: true, incrementKg: true },
        }),
        [] as { id: string; type: string; minKg: number | null; maxKg: number | null; incrementKg: number | null }[]
      ),
      safe(
        prisma.injuryLimitation.findMany({
          // 🔴 อาการชั่วคราวที่หมดอายุแล้วถือว่าไม่มีผล — โชว์ต่อจะทำให้แอดมินคุยผิด
          where: { memberId: id, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          orderBy: { createdAt: "desc" },
          select: { id: true, area: true, severity: true, note: true },
        }),
        [] as { id: string; area: string; severity: string; note: string | null }[]
      ),
      safe(
        prisma.mealFeedback.findMany({
          where: { memberId: id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, foodName: true, slot: true, taste: true, portion: true, note: true, createdAt: true },
        }),
        [] as {
          id: string; foodName: string; slot: string | null;
          taste: number | null; portion: number | null; note: string | null; createdAt: Date;
        }[]
      ),
      safe(
        prisma.readinessCheckin.findMany({
          where: { memberId: id },
          orderBy: { date: "desc" },
          take: 7,
          select: { id: true, date: true, score: true, band: true },
        }),
        [] as { id: string; date: Date; score: number | null; band: string | null }[]
      ),
      safe(
        prisma.programEnrollment.findMany({
          where: { memberId: id },
          orderBy: { startDate: "desc" },
          select: { track: true, status: true, endDate: true },
        }),
        [] as { track: string; status: string; endDate: Date }[]
      ),
    ]);

    const latestEnrollment = enrollments[0] ?? null;

    const appData = {
      foodProfile: foodProfile
        ? {
            allergies: foodProfile.allergies,
            avoidMeats: foodProfile.avoidMeats,
            dislikedVeggies: foodProfile.dislikedVeggies,
            tastePref: foodProfile.tastePref,
            spiceLevel: foodProfile.spiceLevel,
            spiceLabel: SPICE_LABELS[foodProfile.spiceLevel] ?? null,
            cuisines: foodProfile.cuisines,
            budgetPerDay: foodProfile.budgetPerDay,
            healthConditions: foodProfile.healthConditions,
            mealSlots: foodProfile.mealSlots,
          }
        : null,
      trainingProfile: trainingProfile
        ? {
            primaryGoal: trainingProfile.primaryGoal,
            /** แปลเป็นไทยตรงนี้ เพราะตารางคำอยู่ใน lib ฝั่ง server — หน้าเว็บไม่ต้องรู้จักคีย์อังกฤษ */
            primaryGoalLabel: GOAL_TH[trainingProfile.primaryGoal] ?? trainingProfile.primaryGoal,
            daysPerWeek: trainingProfile.daysPerWeek,
            sessionMin: trainingProfile.sessionMin,
            trainDays: trainingProfile.trainDays,
            trainDaysLabel: trainingProfile.trainDays.map((d) => DAY_TH[d] ?? d),
            likes: trainingProfile.likes,
            /** คำที่ user พิมพ์เองไม่มีในตาราง = คงคำเดิม ดีกว่าโชว์ช่องว่าง */
            likesLabel: trainingProfile.likes.map(tagTh),
            dislikes: trainingProfile.dislikes,
            dislikesLabel: trainingProfile.dislikes.map(tagTh),
            experienceMonths: trainingProfile.experienceMonths,
            parqFlag: trainingProfile.parqFlag,
            calibration: trainingProfile.calibration,
          }
        : null,
      equipment: equipment.map((e) => ({
        id: e.id,
        type: e.type,
        typeLabel: EQUIPMENT_LABEL_TH[e.type] ?? e.type,
        minKg: e.minKg,
        maxKg: e.maxKg,
        incrementKg: e.incrementKg,
      })),
      injuries: injuries.map((i) => ({
        id: i.id,
        area: i.area,
        areaLabel: AREA_TH[i.area] ?? i.area,
        severity: i.severity,
        severityLabel: SEVERITY_TH[i.severity] ?? i.severity,
        note: i.note,
      })),
      mealFeedbacks: mealFeedbacks.map((f) => ({
        id: f.id,
        foodName: f.foodName,
        slot: f.slot,
        taste: f.taste,
        portion: f.portion,
        note: f.note,
        createdAt: f.createdAt,
      })),
      readiness: readiness.map((r) => ({
        id: r.id,
        date: r.date,
        dateLabel: thaiDate(r.date, false),
        score: r.score,
        band: r.band,
        /** null = ยังไม่มีข้อมูลพอให้คะแนน (ห้ามเดาเป็น "ปกติ") */
        bandLabel: r.band ? BAND_LABEL_TH[r.band as ReadinessBand] ?? r.band : null,
      })),
      programSummary: {
        count: enrollments.length,
        latestStatus: latestEnrollment?.status ?? null,
        latestTrack: latestEnrollment?.track ?? null,
        latestTrackLabel: latestEnrollment ? trackLabel(latestEnrollment.track) : null,
        latestEndLabel: latestEnrollment ? thaiDate(latestEnrollment.endDate, false) : null,
      },
    };

    return NextResponse.json({
      ...member,
      aiUsageStats,
      appData,
    });
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Failed to fetch member" },
      { status: 500 }
    );
  }
}

// PUT - อัปเดตข้อมูลสมาชิก
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireStaff(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, memberTypeId, aiCoachExpireDate } = body;

    const member = await prisma.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(memberTypeId !== undefined && { memberTypeId: memberTypeId || null }),
        ...(aiCoachExpireDate !== undefined && { aiCoachExpireDate: aiCoachExpireDate ? new Date(aiCoachExpireDate) : null }),
      },
      include: {
        memberType: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        weightLogs: {
          orderBy: { date: "desc" },
          take: 30,
        },
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE - ลบสมาชิก (Hard delete - สมาชิกที่กลับมาจะเริ่มต้นใหม่)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireStaff(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await params;

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, displayName: true, lineUserId: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Delete related data first (due to foreign key constraints)
    // Use extended timeout (30 seconds) for members with lots of data
    await prisma.$transaction(async (tx) => {
      await tx.mealLog.deleteMany({ where: { memberId: id } });
      await tx.weightLog.deleteMany({ where: { memberId: id } });
      await tx.waterLog.deleteMany({ where: { memberId: id } });
      await tx.exerciseLog.deleteMany({ where: { memberId: id } });
      await tx.progressPhoto.deleteMany({ where: { memberId: id } });
      await tx.aiRecommendation.deleteMany({ where: { memberId: id } });
      await tx.aiUsageLog.deleteMany({ where: { memberId: id } });
      await tx.barcodeScanHistory.deleteMany({ where: { memberId: id } });
      await tx.cartItem.deleteMany({ where: { memberId: id } });
      await tx.address.deleteMany({ where: { memberId: id } });
      
      // Delete order items first, then orders (use single query for efficiency)
      const orders = await tx.order.findMany({ where: { memberId: id }, select: { id: true } });
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      await tx.order.deleteMany({ where: { memberId: id } });
      
      // Finally delete the member
      await tx.member.delete({ where: { id } });
    }, {
      maxWait: 10000, // 10 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds timeout for the transaction
    });

    return NextResponse.json({ 
      success: true, 
      message: `Member ${member.displayName || member.lineUserId} deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
