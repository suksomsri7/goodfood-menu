import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToBunny, deleteFromBunny, isBase64Image, isBunnyCdnUrl } from "@/lib/bunny";

// GET - ดึงรายการบัญชีรับชำระเงิน
export async function GET() {
  try {
    const accounts = await prisma.paymentAccount.findMany({
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching payment accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment accounts" },
      { status: 500 }
    );
  }
}

// POST - เพิ่มบัญชีรับชำระเงินใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bankName, accountName, accountNumber, qrCodeUrl, isDefault } = body;

    if (!bankName || !accountName || !accountNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upload QR Code to Bunny CDN if provided
    let finalQrCodeUrl = qrCodeUrl || null;
    if (qrCodeUrl && isBase64Image(qrCodeUrl)) {
      finalQrCodeUrl = await uploadToBunny(qrCodeUrl, `payment/qr-${Date.now()}.png`);
    }

    // If this is set as default, unset all other defaults
    if (isDefault) {
      await prisma.paymentAccount.updateMany({
        data: { isDefault: false },
      });
    }

    const account = await prisma.paymentAccount.create({
      data: {
        bankName,
        accountName,
        accountNumber,
        qrCodeUrl: finalQrCodeUrl,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating payment account:", error);
    return NextResponse.json(
      { error: "Failed to create payment account" },
      { status: 500 }
    );
  }
}
