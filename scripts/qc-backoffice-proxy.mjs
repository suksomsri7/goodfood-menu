/**
 * พร็อกซี QC หน้าหลังบ้าน — ให้ chromium headless ถ่ายจอหลังบ้านได้โดยไม่ต้องล็อกอินมือ
 *
 *   npx tsx scripts/mint-staff-cookie.ts | tail -1 > /tmp/gf_staff_tok
 *   node scripts/qc-backoffice-proxy.mjs &
 *   chromium-browser --headless=new --no-sandbox --window-size=1500,1450 \
 *     --virtual-time-budget=20000 --screenshot=/root/qc.png "http://127.0.0.1:8099/backoffice/ingredients"
 *
 * 🔴 หลังบ้านเช็ค login สองชั้น: คุกกี้ gf_staff (เซิร์ฟเวอร์) + localStorage goodfood_staff (client)
 *    ใส่แค่คุกกี้จะเด้งไปหน้า login แล้วได้ภาพเปล่า — ตัวนี้ยัดให้ทั้งคู่
 * 🔴 ต้องขอ accept-encoding: identity ไม่งั้นได้ gzip มาแล้วแก้ HTML ไม่ได้ → เบราว์เซอร์ค้างยาว
 * 🔴 ?qcOpen=<ข้อความบนปุ่ม> = เปิดฟอร์มให้อัตโนมัติ · &qcScroll=1 = เลื่อนฟอร์มลงล่างสุด
 * 🔴 QC เท่านั้น ห้ามเปิดค้างไว้ — ใครยิง 127.0.0.1:8099 ได้ = เป็นแอดมินหลังบ้านทันที
 */
import http from 'node:http';
import fs from 'node:fs';
const tok = fs.readFileSync('/tmp/gf_staff_tok','utf8').trim();
http.createServer((req, res) => {
  const opt = { host:'127.0.0.1', port:3001, path:req.url, method:req.method,
    headers:{ ...req.headers, host:'127.0.0.1:3001', 'accept-encoding':'identity', cookie:`gf_staff=${tok}`,
      // บางเส้นหลังบ้านเช็ค same-origin จาก referer/origin — ตอน QC ผ่านพร็อกซีต้องเขียนให้ตรง host ปลายทาง
      ...(req.headers.referer ? { referer: req.headers.referer.replace(/^https?:\/\/[^/]+/, 'http://127.0.0.1:3001') } : {}),
      ...(req.headers.origin ? { origin: 'http://127.0.0.1:3001' } : {}) } };
  const up = http.request(opt, r => {
    // หน้า backoffice อ่านสถานะ login จาก localStorage — ยัดให้ก่อน hydrate ตอน QC เท่านั้น
    const ct = String(r.headers['content-type']||'');
    if (ct.includes('text/html')) {
      const chunks=[];
      r.on('data',c=>chunks.push(c));
      r.on('end',()=>{
        let html = Buffer.concat(chunks).toString('utf8');
        const staff = JSON.stringify({ id:'qc', email:'qc@goodfood.local', name:'QC', phone:null, avatarUrl:null,
          roleId:'qc', isActive:true, role:{ id:'qc', name:'Admin', description:null, permissions:['*'] } });
        html = html.replace('<head>', `<head><script>try{localStorage.setItem('goodfood_staff', ${JSON.stringify(staff)})}catch(e){}</script>`);
        // QC: เปิดฟอร์มของวัตถุดิบที่ระบุใน ?qcOpen= ให้อัตโนมัติ (ไว้ถ่ายจอส่วน "จอสั่งอาหารในแอป")
        html = html.replace('</body>', `<script>(function(){
          var m=/[?&]qcOpen=([^&]+)/.exec(location.search); if(!m) return; var want=decodeURIComponent(m[1]);
          var t=setInterval(function(){
            var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return x.textContent.trim()===want});
            if(b.length){ b[0].click(); clearInterval(t);
              if(/[?&]qcScroll=1/.test(location.search)) setTimeout(function(){
                var m=document.querySelector('.overflow-y-auto .overflow-y-auto') || document.querySelector('[class*="max-h-"]');
                if(m) m.scrollTop = m.scrollHeight;
              }, 600);
            }
          }, 400);
        })()</script></body>`);
        const h = { ...r.headers };
        delete h['content-length'];
        h['set-cookie'] = [...(r.headers['set-cookie']||[]), `gf_staff=${tok}; Path=/`];
        res.writeHead(r.statusCode, h);
        res.end(html);
      });
      return;
    }
    const h = { ...r.headers };
    // ให้เบราว์เซอร์ถือคุกกี้ด้วย ไม่ใช่แค่ฝั่งเซิร์ฟเวอร์ (AuthGuard อ่านจากฝั่ง client)
    h['set-cookie'] = [...(r.headers['set-cookie']||[]), `gf_staff=${tok}; Path=/`];
    res.writeHead(r.statusCode, h); r.pipe(res);
  });
  up.on('error', e => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(8099, '127.0.0.1', () => console.log('proxy 8099'));
