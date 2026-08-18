/**
 * QC ปลายทาง: ยิงผ่านตรรกะจริงที่หน้าครัวใช้ กับข้อมูลจริงใน DB
 * รัน: npx tsx scripts/qc-kitchen-sheet.ts [YYYY-MM-DD]
 *
 * ต่างจาก test-recipe.ts ตรงที่อันนั้นเทสสูตรคำนวณด้วยข้อมูลสมมติ
 * อันนี้ตอบคำถามว่า "ลูกค้าจริงของวันนี้ ครัวจะเห็นอะไร"
 */
import { prisma } from "../src/lib/prisma";
import { bkkDay, thaiDate } from "../src/lib/program";
import { membersServedOn, toKitchenSheet } from "../src/lib/programQuery";
import { formatAmount } from "../src/lib/recipe";

(async () => {
  const arg = process.argv[2];
  const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? new Date(`${arg}T00:00:00.000Z`) : bkkDay();

  const served = await membersServedOn(date);
  console.log(`วันที่ ${thaiDate(date)} · ลูกค้า ${served.length} คน · กล่อง ${served.reduce((n, m) => n + m.meals.length, 0)}\n`);

  const profiles = served.length
    ? await prisma.foodProfile.findMany({ where: { memberId: { in: served.map((m) => m.memberId) } }, select: { memberId: true, allergies: true } })
    : [];
  const allergiesOf = new Map(profiles.map((p) => [p.memberId, p.allergies]));

  const slots = toKitchenSheet(served, allergiesOf);
  let withRecipe = 0;
  let withoutRecipe = 0;

  for (const s of slots) {
    console.log(`━━ มื้อ${s.slot} · ${s.boxes} กล่อง`);
    for (const d of s.dishes) {
      console.log(`  ▸ [${d.trackLabel}] ${d.foodName} — ${d.boxes.length} กล่อง${d.noRecipe ? "  ⚠️ ยังไม่มีสูตร" : ""}`);
      if (d.noRecipe || d.ingredients.length === 0) {
        withoutRecipe += d.boxes.length;
        continue;
      }
      withRecipe += d.boxes.length;
      console.log(`    เตรียมรวม: ${d.prep.map((p) => `${p.name} ${formatAmount(p.total, p.unit)}`).join(" · ")}`);
      for (const b of d.boxes) {
        const cols = b.lines.map((l) => `${l.name} ${l.baseAmount}→${l.amount}`).join(" · ");
        console.log(`    ${b.memberName}${b.allergies.length ? ` [แพ้ ${b.allergies.join(",")}]` : ""}: ${cols}`);
        console.log(`      ได้จริง ${b.delivered.kcal} kcal (เป้า ${b.target.kcal}) · P ${b.delivered.protein}/${b.target.protein}`);
        for (const w of b.warnings) console.log(`      ${w}`);
      }
    }
  }

  console.log(`\nสรุป: กล่องที่คิดรายวัตถุดิบได้ ${withRecipe} · ยังต้องตักแบบเดิม ${withoutRecipe}`);
  await prisma.$disconnect();
})();
