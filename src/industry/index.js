'use strict';
// 行业模块：家政保洁（净屿家政 · 示例门店）
//   上门服务：选服务 → 填服务内容（按小时 / 按面积 / 按台数，实时算价）→ 选上门时间窗（上午 / 下午，按空闲保洁师人数放号）→ 地址 / 楼层 / 电梯
//   无电梯 4 层及以上按楼层加收搬运费；门店派单（技能不符或该时段已有订单的保洁师不可选）→ 开始服务 → 服务完成 → 顾客验收并评分（评分记在保洁师名下）
//   价格设置：单价 / 起步 / 搬运费随时可改，顾客端立即按新价计算（已下单订单不变）
const { AppError } = require('../lib/util');
const U = require('../lib/util');
const AP = [['ac', '空调（挂机）'], ['hood', '油烟机'], ['wash', '洗衣机（滚筒/波轮）']];
const WIN = { 540: ['上午', 720], 840: ['下午', 1080] };
const pj = (v, d = {}) => { try { return JSON.parse(v || 'null') || d; } catch { return d; } };
const clean = (v, n) => String(v == null ? '' : v).replace(/[<>\u0000-\u001F]/g, '').trim().slice(0, n);
const int = v => (v === '' || v == null || !Number.isFinite(+v) ? NaN : Math.round(+v));
const LIVE = ['confirmed', 'arrived'];

/** 计价：返回明细行、合计、数量文字（顾客端用同样规则实时预估，以服务端为准） */
function calc(svc, input) {
  const pr = pj(svc.pricing), q = input.qty || {}, lines = [];
  let qtext = '', qn = {};
  if (pr.mode === 'hour') {
    const h = int(q.hours); if (!(h >= 1 && h <= 8)) throw new AppError(400, 'BAD_QTY', '服务时长需为 1–8 小时');
    const ch = Math.max(h, pr.min || 1); qn = { hours: h }; qtext = h + ' 小时';
    lines.push({ label: `${svc.name} ${ch} 小时 × ¥${pr.rate}` + (h < ch ? `（${pr.min} 小时起）` : ''), amount: ch * pr.rate });
  } else if (pr.mode === 'area') {
    const a = int(q.area); if (!(a >= 10 && a <= 2000)) throw new AppError(400, 'BAD_QTY', '请填写房屋面积（10–2000㎡）');
    const ca = Math.max(a, pr.min || 0); qn = { area: a }; qtext = a + '㎡';
    lines.push({ label: `${svc.name} ${ca}㎡ × ¥${pr.rate}` + (a < ca ? `（${pr.min}㎡起）` : ''), amount: ca * pr.rate });
  } else if (pr.mode === 'unit') {
    const parts = [];
    for (const [k, n] of AP) {
      const c = q[k] == null || q[k] === '' ? 0 : int(q[k]); if (!(c >= 0 && c <= 6)) throw new AppError(400, 'BAD_QTY', `${n}数量需为 0–6 台`);
      if (c) { qn[k] = c; lines.push({ label: `${n} × ${c}`, amount: c * pr[k] }); parts.push(n.replace(/（.*）/, '') + '×' + c); }
    }
    if (!lines.length) throw new AppError(400, 'BAD_QTY', '请至少选择 1 台家电');
    qtext = parts.join('、');
  } else lines.push({ label: svc.name, amount: svc.price_cents / 100 });
  const floor = int(input.floor); if (!(floor >= 1 && floor <= 99)) throw new AppError(400, 'BAD_FLOOR', '请填写楼层（1–99）');
  const elev = !(input.elev === false || input.elev === 0 || input.elev === '0');
  const stair = pr.stair != null ? pr.stair : 10;
  if (!elev && floor >= 4) lines.push({ label: `无电梯 ${floor} 楼搬运费（${floor - 3} 层 × ¥${stair}）`, amount: (floor - 3) * stair });
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), qtext, q: qn, floor, elev, mode: pr.mode || 'fixed' };
}
function cleaners(repo) { return repo.listResources().filter(r => r.kind === 'cleaner' && r.active); }
function busyWith(repo, a, b) {
  return repo.liveOn(b.date).find(x => x.id !== b.id && x.assignee_id === a.id && LIVE.includes(x.status) && x.start_min < b.end_min && x.end_min > b.start_min);
}

const IND = {
  slug: 'housekeeping', brand: '净屿家政', codePrefix: 'JY', dbName: 'housekeeping.db', defaultIcon: 'leaf',
  features: ['home-service', 'qty-pricing', 'stair-fee', 'time-windows', 'dispatch', 'customer-acceptance', 'cleaner-ratings', 'price-settings'],
  accounts: { owner: 'jingyu2026', staff: '派单员小屿（演示）', staff2: '客服小净（演示）' },
  terms: { resource: '保洁师', assignee: '保洁师', storePay: '服务后结算', service: '服务', booking: '预约上门' },
  resourceMode: 'none', resourceKind: 'cleaner', assignKind: 'cleaner', assignNoOverlap: true,
  capacityMode: () => 'pool',            // 按空闲保洁师人数放号（门店容量 = 保洁师人数）
  slotStarts: () => [540, 840],          // 上门时间窗：上午 09:00–12:00 / 下午 14:00–18:00
  windowEnd: m => (WIN[m] ? WIN[m][1] : m + 180),
  windowLabel: m => (WIN[m] ? WIN[m][0] : ''),
  cutoffMin: 120,                        // 当天时间窗需在开始前 2 小时预约
  rules: {
    review: { tagsPos: ['准时守约', '打扫仔细', '工具专业', '沟通顺畅', '收尾干净', '态度亲切'], tagsNeg: ['迟到', '有遗漏', '工具不全', '沟通不畅'] },
    feedback: { types: ['功能建议', '服务投诉', '保洁师相关', '价格问题', '其他'] },
  },
  steps: [
    { key: 'assigned', label: '已派单', action: '派单', status: 'confirmed', needAssign: true, needAssignText: '请先选择保洁师派单' },
    { key: 'serving', label: '服务中', action: '开始服务', status: 'arrived', start: true },
    { key: 'check', label: '待验收', action: '服务完成', status: 'arrived', notify: b => `净屿家政：保洁师已完成本次${b.service_name}，请在小程序「我的」中验收并评分（${b.code}）` },
    { key: 'done', label: '已完成', action: '验收', status: 'done', by: 'customer', waitText: '等待顾客验收' },
  ],
  noAutoNoshow: b => !!b.assignee_id,    // 已派单的上门订单由门店处理，不自动记爽约
  onStep(ctx, b, nx) {
    if (nx.key === 'serving' && !b.assignee_id) throw new AppError(409, 'NEED_ASSIGN', '请先派单');
  },
  canAssign(ctx, b, a) {
    if (b.status === 'pending') return '请先确认订单再派单';
    if (b.progress && b.progress !== 'assigned') return '服务已开始，不能改派';
    if (!pj(a.skills, []).includes(b.service_id)) return `${a.name}不擅长「${b.service_name}」`;
    const x = busyWith(ctx.repo, a, b); if (x) return `${a.name}该时段已有订单（${x.service_name}）`;
    return null;
  },
  onAssign: (ctx, b) => (b.progress ? {} : { progress: 'assigned' }),
  resourceDto(r, o) { const e = pj(r.extra); o.yrs = e.yrs || null; o.skillNames = e.skillNames || []; },
  validatePricing(pr, svc) {
    const mode = (svc && pj(svc.pricing).mode) || (pr && pr.mode);
    const n = (k, lo, hi, label) => { const v = int(pr && pr[k]); if (!(v >= lo && v <= hi)) throw new AppError(400, 'BAD_INPUT', `${label}需为 ${lo}–${hi} 的整数`); return v; };
    const out = { mode, stair: n('stair', 0, 999, '无电梯搬运费') };
    if (mode === 'hour') Object.assign(out, { rate: n('rate', 0, 9999, '单价'), min: n('min', 1, 8, '起步小时') });
    else if (mode === 'area') Object.assign(out, { rate: n('rate', 0, 9999, '单价'), min: n('min', 10, 300, '起算面积') });
    else if (mode === 'unit') for (const [k, nm] of AP) out[k] = n(k, 0, 9999, nm + '单价');
    else throw new AppError(400, 'BAD_INPUT', '计价方式不正确');
    return out;
  },
  pricingBase: pr => ({ price: pr.mode === 'unit' ? Math.min(...AP.map(([k]) => pr[k])) : pr.rate }),
  publicInfo: () => ({ appliances: AP, windows: Object.entries(WIN).map(([m, w]) => ({ start: U.toHm(+m), end: U.toHm(w[1]), label: w[0] })), cutoffMin: 120 }),
  plan(ctx, svc, cust, input, P) {
    if (!cust) return P;
    const address = clean(input.address, 40);
    if (address.length < 4) throw new AppError(400, 'NEED_ADDRESS', '请填写上门地址（小区 / 楼栋 / 门牌号，4–40 字）');
    const c = calc(svc, input);
    return { ...P, price_cents: Math.round(c.total * 100), lines: c.lines, address,
      extra: { hk: { mode: c.mode, q: c.q, qtext: c.qtext, floor: c.floor, elev: c.elev } } };
  },
  dto(b, o) { o.windowLabel = WIN[b.start_min] ? WIN[b.start_min][0] : null; },
  dashboard(ctx) {
    const d = U.today(), db = ctx.repo.db;
    const wait = db.prepare("SELECT COUNT(*) n FROM bookings WHERE date>=? AND status='confirmed' AND assignee_id IS NULL AND kind='book'").get(d).n;
    const chk = db.prepare("SELECT COUNT(*) n FROM bookings WHERE status='arrived' AND progress='check'").get().n;
    return { tiles: [{ k: '待派单', v: wait }, { k: '待验收', v: chk }] };
  },
  routes: {
    public(app, ctx, { customer }) {
      // 顾客验收：保洁师「服务完成」后，由顾客确认验收 → 订单完成（随后可评分，评分记在保洁师名下）
      app.post('/me/bookings/:id/accept', async req => {
        const c = customer(req), { repo, bus } = ctx;
        const id = repo.tx(() => {
          const b = repo.getBooking(+req.params.id);
          if (!b || b.customer_id !== c.id) throw new AppError(404, 'BOOKING_NOT_FOUND', '订单不存在');
          if (b.status !== 'arrived' || b.progress !== 'check') throw new AppError(409, 'BAD_STATE', '保洁师完成服务后才能验收');
          repo.updateBooking(b.id, { progress: 'done', status: 'done' });
          ctx.ext.consumeOnDone(b.id, c.phone);
          repo.audit({ actor_type: 'customer', actor_id: c.id, actor_name: c.phone, action: 'booking.accept', target: 'booking:' + b.id, detail: { code: b.code } });
          return b.id;
        });
        bus.emit('change', { type: 'booking.accept', id });
        return { booking: ctx.reviews.attachToBookings([ctx.booking.dto(repo.getBooking(id), { cust: c })])[0] };
      });
    },
  },
  seed(h) {
    const { repo, d } = h;
    repo.upsertShop({ name: '净屿家政', phone: '0592-0000-0000', address: 'XX市XX区XX路 18 号（示例地址）', open_min: 540, close_min: 1080, step_min: 60, book_days: 7, lead_min: 120, capacity: 4 });
    const SV = [
      { name: '日常保洁', img: 'h1_daily', descr: '按小时计费 · 3 小时起', pr: { mode: 'hour', rate: 50, min: 3, stair: 10 }, icon: 'leaf', color: 4, hot: 1 },
      { name: '深度保洁', img: 'h2_deep', descr: '按面积计费 · 厨房油污 / 卫生间水垢', pr: { mode: 'area', rate: 8, min: 60, stair: 10 }, icon: 'gem', color: 1 },
      { name: '开荒保洁', img: 'h3_open', descr: '新房 / 装修后 · 玻璃与地面胶渍', pr: { mode: 'area', rate: 12, min: 60, stair: 10 }, icon: 'star', color: 3, dep: 50 },
      { name: '家电清洗', img: 'h4_appl', descr: '空调 / 油烟机 / 洗衣机 · 按台计费', pr: { mode: 'unit', ac: 120, hood: 180, wash: 150, stair: 10 }, icon: 'drop', color: 2 },
    ];
    const S = SV.map((s, i) => ({ ...s, id: repo.insertService({ name: s.name, descr: s.descr, price_cents: IND.pricingBase(s.pr).price * 100, duration_min: 180, icon: s.icon, color: s.color, hot: s.hot || 0, sort: i,
      deposit_on: s.dep ? 1 : 0, deposit_cents: (s.dep || 30) * 100, images: JSON.stringify(h.img(s.img)), pricing: s.pr }) }));
    const sk = (...ix) => JSON.stringify(ix.map(i => S[i].id)), nm = (...ix) => ix.map(i => ['日常', '深度', '开荒', '家电'][i]);
    const CL = [
      ['王阿姨', 8, [0, 1], '#E2F6F8', '做事细致，擅长厨房油污与收纳整理'], ['李阿姨', 5, [0, 1, 2], '#FFF6D6', '开荒经验丰富，自带专业工具'],
      ['张师傅', 6, [3, 2], '#EDE7FA', '家电拆洗 6 年，空调 / 油烟机深度清洗'], ['刘阿姨', 3, [0, 1], '#FDEBE2', '手脚麻利，日常保洁好评多'],
    ].map(([name, yrs, ix, color, intro], i) => repo.insertResource({ kind: 'cleaner', name, title: `从业 ${yrs} 年`, intro, tags: JSON.stringify(nm(...ix)), skills: sk(...ix), start_min: 540, end_min: 1080,
      color, avatar: i, letter: String.fromCharCode(65 + i), sort: i, extra: JSON.stringify({ yrs, skillNames: nm(...ix) }), seed: 1 }));
    const svcIn = { 0: { hours: 3 }, 1: { area: 90 }, 2: { area: 110 }, 3: { ac: 1 } };
    const mk = (si, date, win, status, who, o = {}) => {
      const s = repo.getService(S[si].id), inp = { qty: o.qty || svcIn[si], floor: who.floor || 12, elev: who.elev !== false }, c = calc(s, inp), m = win === 'am' ? 540 : 840;
      return h.bk({ svc: { id: s.id, name: s.name }, price: c.total, date, hm: m, end: WIN[m][1], phone: who.phone, name: who.name, status, address: who.addr, note: o.note || '',
        extra: { hk: { mode: c.mode, q: c.q, qtext: c.qtext, floor: c.floor, elev: c.elev }, lines: c.lines }, progress: o.progress || null, assignee_id: o.cid || null, ...(o.f || {}) });
    };
    const ME = { phone: '13812345678', name: '演示用户', addr: '示例花园 3 栋 1201', floor: 12 };
    const P = n => ({ phone: '136100' + String(n).padStart(5, '0'), name: ['周先生', '吴女士', '郑先生', '孙女士', '冯女士', '何先生', '韩女士', '许小姐', '陈女士'][n - 1],
      addr: ['示例小区 8 栋 502', '示例公寓 2 栋 1806', '示例新城 5 栋 901', '示例苑 6 栋 302', '示例湾 1 栋 2201', '示例里 4 号 601', '示例城 9 栋 1103', '示例府 3 栋 702', '示例家园 7 栋 401'][n - 1],
      floor: [5, 18, 9, 3, 22, 6, 11, 7, 4][n - 1], elev: n !== 1 && n !== 6 });
    const [W, L, Z, LIU] = CL;
    // 过去：已完成 + 评价（评分记在保洁师名下）
    const done = [
      mk(0, d(-3), 'pm', 'done', P(4), { cid: W, progress: 'done' }), mk(1, d(-5), 'am', 'done', P(5), { cid: L, progress: 'done', qty: { area: 80 } }),
      mk(3, d(-4), 'pm', 'done', P(6), { cid: Z, progress: 'done', qty: { ac: 1, wash: 1 } }), mk(0, d(-6), 'am', 'done', P(7), { cid: LIU, progress: 'done', qty: { hours: 5 } }),
      mk(1, d(-2), 'pm', 'done', P(8), { cid: W, progress: 'done', qty: { area: 120 } }), mk(2, d(-9), 'am', 'done', P(9), { cid: L, progress: 'done', qty: { area: 95 } }),
      mk(0, d(-8), 'am', 'done', ME, { cid: LIU, progress: 'done' }),
    ];
    h.reviews(done, [
      [5, ['打扫仔细', '准时守约'], '王阿姨很细心，厨房的油污和窗槽都擦得很干净，提前 10 分钟就到了。', 'h1_daily', '感谢认可～王阿姨下次上门也会照这个标准！'],
      [5, ['工具专业'], '深度保洁做得很到位，卫生间水垢基本都去掉了。', 'h2_deep', null],
      [4, ['沟通顺畅'], '空调拆洗很专业，就是洗衣机那台多等了一会儿。', null, '下次会提前确认机型、备好配件，减少等待～'],
      [5, ['收尾干净', '态度亲切'], '', null, null],
      [5, ['工具专业', '打扫仔细'], '120 平深度保洁，两位阿姨配合很好，价格提前算清楚了，没有乱加钱。', null, null],
      [3, ['有遗漏'], '开荒整体还行，阳台玻璃有些胶渍没清掉，联系后第二天来补了。', null, '抱歉给您添麻烦！已安排复查，后续开荒会增加阳台检查项。'],
    ]);
    // 今天：上午 1 单服务中、1 单待顾客验收（演示账号）；下午 2 单已派单
    mk(0, d(0), 'am', 'arrived', ME, { cid: W, progress: 'check', f: { arrived_at: Date.now() - 3 * 3600e3, started_at: Date.now() - 3 * 3600e3 } });
    mk(0, d(0), 'am', 'arrived', P(2), { cid: L, progress: 'serving', qty: { hours: 4 }, f: { arrived_at: Date.now() - 2 * 3600e3, started_at: Date.now() - 2 * 3600e3 } });
    mk(3, d(0), 'pm', 'confirmed', P(1), { cid: Z, progress: 'assigned', qty: { ac: 2, hood: 1 } });
    mk(1, d(0), 'pm', 'confirmed', P(3), { cid: LIU, progress: 'assigned', qty: { area: 75 } });
    // 明天：2 单待派单（含演示账号的深度保洁）；后天 1 单待确认（新客）
    mk(1, d(1), 'pm', 'confirmed', ME);
    mk(2, d(1), 'am', 'confirmed', P(3), { note: '刚装修完，有胶渍' });
    mk(0, d(2), 'am', 'pending', { phone: '13700001111', name: '林小姐', addr: '示例广场 2 栋 1502', floor: 15 });
    // 爽约示例：90 天内爽约 2 次 → 默认规则下被限制线上预约
    const NS = { phone: '13300006666', name: '赵先生', addr: '示例路 66 号 3 楼', floor: 3 };
    mk(0, d(-20), 'am', 'no_show', NS, { f: { noshow_by: 'manual' } }); mk(1, d(-11), 'pm', 'no_show', NS, { f: { noshow_by: 'manual' } });
    h.feedback(P(5).phone, '功能建议', '希望下单时可以备注家里有宠物，提醒阿姨注意。', 6, true, '已在备注提示中加入「家有宠物」示例（示例）');
    h.feedback(P(8).phone, '价格问题', '面积起算 60㎡ 对小户型不太友好，能否按实际面积？', 2, false);
  },
};
module.exports = IND;
