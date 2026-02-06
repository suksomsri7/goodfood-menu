const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const r = await p.restaurant.count();
    const f = await p.food.count();
    const pk = await p.package.count();
    const m = await p.member.count();
    console.log('Restaurants:', r);
    console.log('Foods:', f);
    console.log('Packages:', pk);
    console.log('Members:', m);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
