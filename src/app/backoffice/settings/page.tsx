"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/backoffice/Header";
import { 
  CreditCard, 
  Plus, 
  Pencil, 
  Trash2, 
  QrCode, 
  Upload, 
  X,
  Star,
  Check,
  Clock,
  UserX,
  Save,
  Loader2,
  Crown,
  Banknote,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  qrCodeUrl: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

const bankOptions = [
  { value: "กสิกรไทย", label: "ธนาคารกสิกรไทย", color: "#138f2d" },
  { value: "ไทยพาณิชย์", label: "ธนาคารไทยพาณิชย์", color: "#4e2a84" },
  { value: "กรุงเทพ", label: "ธนาคารกรุงเทพ", color: "#1e4598" },
  { value: "กรุงไทย", label: "ธนาคารกรุงไทย", color: "#1ba5e0" },
  { value: "กรุงศรี", label: "ธนาคารกรุงศรีอยุธยา", color: "#fec601" },
  { value: "ทหารไทยธนชาต", label: "ธนาคารทหารไทยธนชาต", color: "#1279be" },
  { value: "ออมสิน", label: "ธนาคารออมสิน", color: "#eb198d" },
  { value: "PromptPay", label: "พร้อมเพย์", color: "#1e3a8a" },
];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  
  // Activity Settings state
  const [activitySettings, setActivitySettings] = useState({
    inactiveDaysThreshold: 7,
    gracePeriodDays: 2,
  });
  const [activityLoading, setActivityLoading] = useState(true);
  const [activitySaving, setActivitySaving] = useState(false);
  
  // Premium Settings state
  const [premiumSettings, setPremiumSettings] = useState({
    premiumPrice: 299,
    premiumDays: 30,
  });
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [premiumSaving, setPremiumSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAccounts();
    fetchActivitySettings();
    fetchPremiumSettings();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/settings/payment-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivitySettings = async () => {
    try {
      const res = await fetch("/api/settings/ai-coach");
      if (res.ok) {
        const data = await res.json();
        setActivitySettings({
          inactiveDaysThreshold: data.inactiveDaysThreshold ?? 7,
          gracePeriodDays: data.gracePeriodDays ?? 2,
        });
      }
    } catch (error) {
      console.error("Error fetching activity settings:", error);
    } finally {
      setActivityLoading(false);
    }
  };

  const saveActivitySettings = async () => {
    setActivitySaving(true);
    try {
      const res = await fetch("/api/settings/ai-coach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activitySettings),
      });
      if (res.ok) {
        alert("บันทึกสำเร็จ");
      } else {
        alert("เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error saving activity settings:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setActivitySaving(false);
    }
  };

  const fetchPremiumSettings = async () => {
    try {
      const res = await fetch("/api/settings/ai-coach");
      if (res.ok) {
        const data = await res.json();
        setPremiumSettings({
          premiumPrice: data.premiumPrice ?? 299,
          premiumDays: data.premiumDays ?? 30,
        });
      }
    } catch (error) {
      console.error("Error fetching premium settings:", error);
    } finally {
      setPremiumLoading(false);
    }
  };

  const savePremiumSettings = async () => {
    setPremiumSaving(true);
    try {
      const res = await fetch("/api/settings/ai-coach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(premiumSettings),
      });
      if (res.ok) {
        alert("บันทึกสำเร็จ");
      } else {
        alert("เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error saving premium settings:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setPremiumSaving(false);
    }
  };

  const resetForm = () => {
    setBankName("");
    setAccountName("");
    setAccountNumber("");
    setQrCodePreview(null);
    setIsDefault(false);
    setEditingAccount(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (account: PaymentAccount) => {
    setEditingAccount(account);
    setBankName(account.bankName);
    setAccountName(account.accountName);
    setAccountNumber(account.accountNumber);
    setQrCodePreview(account.qrCodeUrl);
    setIsDefault(account.isDefault);
    setShowModal(true);
  };

  const handleQrCodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrCodePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!bankName || !accountName || !accountNumber) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        bankName,
        accountName,
        accountNumber,
        qrCodeUrl: qrCodePreview,
        isDefault,
      };

      let res;
      if (editingAccount) {
        res = await fetch(`/api/settings/payment-accounts/${editingAccount.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/settings/payment-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        fetchAccounts();
        setShowModal(false);
        resetForm();
      } else {
        alert("เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error saving account:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบบัญชีนี้?")) return;

    try {
      const res = await fetch(`/api/settings/payment-accounts/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAccounts();
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/payment-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        fetchAccounts();
      }
    } catch (error) {
      console.error("Error setting default:", error);
    }
  };

  const getBankColor = (bank: string) => {
    const found = bankOptions.find(b => b.value === bank);
    return found?.color || "#666666";
  };

  return (
    <div>
      <Header title="ตั้งค่า" subtitle="จัดการการตั้งค่าระบบ" />
      
      <div className="p-6 space-y-6">
        {/* Activity Status Settings Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <UserX className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">ตั้งค่าสถานะสมาชิก</h2>
                <p className="text-sm text-gray-500">กำหนดการเปลี่ยนสถานะ Active/Inactive</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {activityLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Inactive Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-2" />
                      จำนวนวันไม่ใช้งานก่อนเปลี่ยนเป็น Inactive
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={activitySettings.inactiveDaysThreshold}
                        onChange={(e) => setActivitySettings(prev => ({
                          ...prev,
                          inactiveDaysThreshold: parseInt(e.target.value) || 7,
                        }))}
                        className="w-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-center"
                      />
                      <span className="text-gray-600">วัน</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      หากสมาชิกไม่เปิดแอปเกินจำนวนวันนี้ ระบบจะเปลี่ยนสถานะเป็น Inactive
                    </p>
                  </div>

                  {/* Grace Period */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-2" />
                      ระยะเวลาเตือนก่อนเปลี่ยนสถานะ
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        value={activitySettings.gracePeriodDays}
                        onChange={(e) => setActivitySettings(prev => ({
                          ...prev,
                          gracePeriodDays: parseInt(e.target.value) || 0,
                        }))}
                        className="w-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-center"
                      />
                      <span className="text-gray-600">วัน</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ส่งข้อความเตือนก่อนเปลี่ยนสถานะกี่วัน (0 = ไม่เตือน)
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <h4 className="font-medium text-orange-800 mb-2">การทำงานของระบบ</h4>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• สมาชิกที่ Inactive จะไม่ได้รับข้อความ AI Coach อัตโนมัติ</li>
                    <li>• เมื่อสมาชิก Inactive กลับมาเปิดแอป จะแสดง Modal ยินดีต้อนรับกลับ</li>
                    <li>• สมาชิกสามารถเลือก &quot;ตั้งเป้าหมายใหม่&quot; หรือ &quot;ข้าม&quot; ได้</li>
                    <li>• ทั้งสองตัวเลือกจะเปลี่ยนสถานะกลับเป็น Active ทันที</li>
                  </ul>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={saveActivitySettings}
                    disabled={activitySaving}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {activitySaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Premium Settings Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">ตั้งค่า Premium</h2>
                <p className="text-sm text-gray-500">กำหนดราคาและระยะเวลาแพ็กเกจ Premium</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {premiumLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Premium Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Banknote className="w-4 h-4 inline mr-2" />
                      ราคาอัพเกรด Premium
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={premiumSettings.premiumPrice}
                        onChange={(e) => setPremiumSettings(prev => ({
                          ...prev,
                          premiumPrice: parseInt(e.target.value) || 299,
                        }))}
                        className="w-32 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-center"
                      />
                      <span className="text-gray-600">บาท</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ราคาที่แสดงในหน้าอัพเกรดและใบเสนอราคา
                    </p>
                  </div>

                  {/* Premium Days */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      จำนวนวัน Premium
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={premiumSettings.premiumDays}
                        onChange={(e) => setPremiumSettings(prev => ({
                          ...prev,
                          premiumDays: parseInt(e.target.value) || 30,
                        }))}
                        className="w-32 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-center"
                      />
                      <span className="text-gray-600">วัน</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ระยะเวลาการใช้งาน Premium หลังชำระเงิน
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="font-medium text-purple-800 mb-2">รายละเอียดแพ็กเกจ Premium</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• ใช้งาน AI Coach ได้ไม่จำกัด</li>
                    <li>• วิเคราะห์อาหารจากรูปถ่าย, สแกนบาร์โค้ด</li>
                    <li>• AI ช่วยเลือกเมนูอาหาร</li>
                    <li>• วิเคราะห์การออกกำลังกาย</li>
                    <li>• รับข้อความให้กำลังใจจาก AI ทุกวัน</li>
                  </ul>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={savePremiumSettings}
                    disabled={premiumSaving}
                    className="px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {premiumSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Accounts Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">บัญชีรับชำระเงิน</h2>
                <p className="text-sm text-gray-500">จัดการบัญชีธนาคารและ QR Code</p>
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              เพิ่มบัญชี
            </button>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 mt-4">กำลังโหลด...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">ยังไม่มีบัญชีรับชำระเงิน</p>
                <button
                  onClick={openAddModal}
                  className="mt-4 text-green-600 hover:underline"
                >
                  + เพิ่มบัญชีแรก
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      account.isDefault
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {account.isDefault && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Star className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {account.qrCodeUrl ? (
                        <img
                          src={account.qrCodeUrl}
                          alt="QR Code"
                          className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                          <QrCode className="w-8 h-8 text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getBankColor(account.bankName) }}
                          />
                          <span className="font-semibold text-gray-800 text-sm">
                            {account.bankName}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm truncate">{account.accountName}</p>
                        <p className="font-mono text-gray-800 mt-1">{account.accountNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                      {!account.isDefault && (
                        <button
                          onClick={() => handleSetDefault(account.id)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          ตั้งเป็นหลัก
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(account)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingAccount ? "แก้ไขบัญชี" : "เพิ่มบัญชีใหม่"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ธนาคาร
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    <option value="">เลือกธนาคาร</option>
                    {bankOptions.map((bank) => (
                      <option key={bank.value} value={bank.value}>
                        {bank.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อบัญชี
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="ชื่อ-นามสกุล"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขบัญชี / เบอร์พร้อมเพย์
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="xxx-x-xxxxx-x"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono"
                  />
                </div>

                {/* QR Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    QR Code
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleQrCodeUpload}
                    className="hidden"
                  />
                  {qrCodePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={qrCodePreview}
                        alt="QR Code Preview"
                        className="w-40 h-40 rounded-xl object-cover border border-gray-200"
                      />
                      <button
                        onClick={() => setQrCodePreview(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-green-500 hover:text-green-500 transition-colors"
                    >
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-sm">อัปโหลด QR</span>
                    </button>
                  )}
                </div>

                {/* Set as Default */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setIsDefault(!isDefault)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isDefault
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 hover:border-green-500"
                    }`}
                  >
                    {isDefault && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-700">ตั้งเป็นบัญชีหลัก</span>
                </label>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
