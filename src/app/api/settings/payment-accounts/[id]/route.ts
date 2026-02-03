import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToBunny, deleteFromBunny, isBase64Image, isBunnyCdnUrl } from "@/lib/bunny";

// GET - ดึงบัญชีตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await prisma.paymentAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Payment account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error fetching payment account:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment account" },
      { status: 500 }
    );
  }
}

// PATCH - แก้ไขบัญชี
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { bankName, accountName, accountNumber, qrCodeUrl, isActive, isDefault } = body;

    // Get existing account
    const existingAccount = await prisma.paymentAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Payment account not found" },
        { status: 404 }
      );
    }

    // Handle QR Code upload/update
    let finalQrCodeUrl = existingAccount.qrCodeUrl;
    if (qrCodeUrl !== undefined) {
      if (qrCodeUrl && isBase64Image(qrCodeUrl)) {
        // Delete old QR code if exists
        if (existingAccount.qrCodeUrl && isBunnyCdnUrl(existingAccount.qrCodeUrl)) {
          await deleteFromBunny(existingAccount.qrCodeUrl);
        }
        // Upload new QR code
        finalQrCodeUrl = await uploadToBunny(qrCodeUrl, `payment/qr-${Date.now()}.png`);
      } else if (qrCodeUrl === null || qrCodeUrl === "") {
        // Remove QR code
        if (existingAccount.qrCodeUrl && isBunnyCdnUrl(existingAccount.qrCodeUrl)) {
          await deleteFromBunny(existingAccount.qrCodeUrl);
        }
        finalQrCodeUrl = null;
      } else if (isBunnyCdnUrl(qrCodeUrl)) {
        finalQrCodeUrl = qrCodeUrl;
      }
    }

    // If this is set as default, unset all other defaults
    if (isDefault) {
      await prisma.paymentAccount.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    const account = await prisma.paymentAccount.update({
      where: { id },
      data: {
        ...(bankName !== undefined && { bankName }),
        ...(accountName !== undefined && { accountName }),
        ...(accountNumber !== undefined && { accountNumber }),
        qrCodeUrl: finalQrCodeUrl,
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error updating payment account:", error);
    return NextResponse.json(
      { error: "Failed to update payment account" },
      { status: 500 }
    );
  }
}

// DELETE - ลบบัญชี
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get existing account to delete QR code
    const existingAccount = await prisma.paymentAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Payment account not found" },
        { status: 404 }
      );
    }

    // Delete QR code from Bunny CDN
    if (existingAccount.qrCodeUrl && isBunnyCdnUrl(existingAccount.qrCodeUrl)) {
      await deleteFromBunny(existingAccount.qrCodeUrl);
    }

    await prisma.paymentAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment account:", error);
    return NextResponse.json(
      { error: "Failed to delete payment account" },
      { status: 500 }
    );
  }
}
