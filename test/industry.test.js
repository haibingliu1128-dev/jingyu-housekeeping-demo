'use strict';
// 家政行业功能测试：按小时/面积/台数计价 + 无电梯搬运费、上午/下午时间窗与容量、派单（技能/档期冲突拦截）、上门进度、顾客验收 → 评分记在保洁师名下、价格设置与权限
const { test, before, after } = require('node:test');
const { harness } = require('./helpers');
const H = harness(), { assert, D, api, login, newPhone, setRule, resetRules } = H;
let OWNER, STAFF;
before(async () => { await H.start(); ({ OWNER, STAFF } = H); });
after(() => H.stop());
const cl = name => H.R.listResources().find(r => r.name === name);
const base = (sid, qty, o = {}) => ({ serviceId: sid, qty, date: D(3), time: '09:00', name: '测试', address: '测试小区 2 栋 301', floor: 3, elev: 1, ...o });
const regular = async () => { const p = newPhone(), t = await login(p); H.makeRegular(p); return { p, t }; };
const near = id => { const s = Date.now() + 3600e3; H.R.updateBooking(id, { start_at: s, end_at: s + 3 * 3600e3 }); };

test('计价：按小时（起步）/ 按面积（起算）/ 按台数；无电梯 4 层起加收搬运费；参数校验', async () => {
  const { t } = await regular();
  const q = async b => (await api('POST', '/api/quote', b, t));
  let r = await q(base(1, { hours: 2 })); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.price, 150); assert.match(r.body.lines[0].label, /3 小时 × ¥50（3 小时起）/);
  assert.equal((await q(base(1, { hours: 5 }))).body.price, 250);
  r = await q(base(2, { area: 50 })); assert.equal(r.body.price, 480); assert.match(r.body.lines[0].label, /60㎡ × ¥8（60㎡起）/);
  assert.equal((await q(base(3, { area: 100 }))).body.price, 1200);
  r = await q(base(4, { ac: 2, hood: 1 })); assert.equal(r.body.price, 420); assert.equal(r.body.lines.length, 2);
  r = await q(base(1, { hours: 3 }, { floor: 6, elev: 0 })); assert.equal(r.body.price, 180); assert.match(r.body.lines[1].label, /无电梯 6 楼搬运费（3 层 × ¥10）/);
  assert.equal((await q(base(1, { hours: 3 }, { floor: 6, elev: 1 }))).body.price, 150, '有电梯不加收');
  assert.equal((await q(base(1, { hours: 3 }, { floor: 3, elev: 0 }))).body.price, 150, '3 层及以下不加收');
  for (const [b, code] of [[base(1, { hours: 0 }), 'BAD_QTY'], [base(2, { area: 5 }), 'BAD_QTY'], [base(4, { ac: 0 }), 'BAD_QTY'], [base(1, { hours: 3 }, { address: '' }), 'NEED_ADDRESS'], [base(1, { hours: 3 }, { floor: 0 }), 'BAD_FLOOR']]) {
    const x = await q(b); assert.equal(x.status, 400, code); assert.equal(x.body.error.code, code);
  }
  const bk = await api('POST', '/api/bookings', base(1, { hours: 4 }, { floor: 8, elev: 0 }), t);
  assert.equal(bk.status, 201, JSON.stringify(bk.body)); assert.equal(bk.body.booking.price, 250); assert.equal(bk.body.booking.address, '测试小区 2 栋 301');
  assert.equal(bk.body.booking.extra.hk.qtext, '4 小时'); assert.equal(bk.body.booking.extra.hk.elev, false); assert.equal(bk.body.booking.endTime, '12:00'); assert.equal(bk.body.booking.windowLabel, '上午');
});

test('时间窗：只有上午 / 下午两个时间窗；非时间窗被拒；同一时间窗按保洁师人数（4）放号，约满后显示「已约」', async () => {
  const a = (await api('GET', `/api/availability?serviceId=1&from=${D(6)}&days=1`)).body.days[0];
  assert.deepEqual(a.slots.map(s => [s.time, s.end, s.label]), [['09:00', '12:00', '上午'], ['14:00', '18:00', '下午']]);
  const { t } = await regular();
  const bad = await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(6), time: '10:00' }), t);
  assert.equal(bad.status, 400); assert.equal(bad.body.error.code, 'BAD_SLOT');
  await setRule({ perDay: { on: false }, maxOpen: { on: false }, confirmNew: { on: false } });
  const used = H.R.overlapCount(D(6), 840, 1080), ids = [];
  for (let i = used; i < 4; i++) { const r = await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(6), time: '14:00' }), await login(newPhone())); assert.equal(r.status, 201, JSON.stringify(r.body)); ids.push(r.body.booking.id); }
  const full = await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(6), time: '14:00' }), await login(newPhone()));
  assert.equal(full.status, 409); assert.equal(full.body.error.code, 'SLOT_TAKEN');
  const s = (await api('GET', `/api/availability?serviceId=1&from=${D(6)}&days=1`)).body.days[0].slots.find(x => x.time === '14:00');
  assert.equal(s.ok, false); assert.equal(s.why, '已约');
  for (const id of ids) H.R.updateBooking(id, { status: 'cancelled' });
  await resetRules();
});

test('派单：技能不符 / 同一时段已有订单的保洁师不能派；未派单不能开始；已派单顾客不能自助取消', async () => {
  const { t } = await regular(), { t: t2 } = await regular();
  const b1 = (await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(4), time: '14:00' }), t)).body.booking;
  const b2 = (await api('POST', '/api/bookings', base(2, { area: 90 }, { date: D(4), time: '14:00' }), t2)).body.booking;
  assert.equal(b1.status, 'confirmed');
  const nx = await api('POST', `/api/merchant/bookings/${b1.id}/next`, null, STAFF);
  assert.equal(nx.status, 409); assert.equal(nx.body.error.code, 'NEED_ASSIGN');
  const z = await api('POST', `/api/merchant/bookings/${b1.id}/assign`, { assigneeId: cl('张师傅').id }, STAFF);
  assert.equal(z.status, 409); assert.match(z.body.error.message, /张师傅不擅长「日常保洁」/);
  const w = await api('POST', `/api/merchant/bookings/${b1.id}/assign`, { assigneeId: cl('王阿姨').id }, STAFF);
  assert.equal(w.status, 200, JSON.stringify(w.body)); assert.equal(w.body.assigneeName, '王阿姨'); assert.equal(w.body.progress, 'assigned'); assert.equal(w.body.statusText, '已派单');
  const busy = await api('POST', `/api/merchant/bookings/${b2.id}/assign`, { assigneeId: cl('王阿姨').id }, STAFF);
  assert.equal(busy.status, 409); assert.match(busy.body.error.message, /王阿姨该时段已有订单（日常保洁）/);
  assert.equal((await api('POST', `/api/merchant/bookings/${b2.id}/assign`, { assigneeId: cl('李阿姨').id }, STAFF)).status, 200);
  const re = await api('POST', `/api/merchant/bookings/${b1.id}/assign`, { assigneeId: cl('刘阿姨').id }, STAFF);
  assert.equal(re.status, 200); assert.equal(re.body.assigneeName, '刘阿姨', '可改派');
  const c = await api('POST', `/api/bookings/${b1.id}/cancel`, null, t);
  assert.equal(c.status, 409); assert.match(c.body.error.message, /已派单，请联系门店取消/);
  const early = await api('POST', `/api/merchant/bookings/${b1.id}/next`, null, STAFF);
  assert.equal(early.status, 409); assert.equal(early.body.error.code, 'TOO_EARLY', '离上门超过 3 小时不能开始');
  const sh = (await api('GET', '/api/shop')).body.industry;
  assert.deepEqual(sh.steps.map(x => x.label), ['已派单', '服务中', '待验收', '已完成']); assert.equal(sh.steps[3].by, 'customer');
  const pp = newPhone(); await login(pp);
  const pend = H.insert(pp, 'pending', { date: D(5), start: 540, serviceId: 1 });
  assert.match((await api('POST', `/api/merchant/bookings/${pend}/assign`, { assigneeId: cl('王阿姨').id }, STAFF)).body.error.message, /请先确认订单/);
});

test('上门进度：开始服务 → 服务完成（短信通知验收）→ 门店不能代替验收 → 顾客验收 → 评分记在保洁师名下', async () => {
  const { p, t } = await regular(), other = await login(newPhone());
  const b = (await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(5), time: '09:00' }), t)).body.booking;
  await api('POST', `/api/merchant/bookings/${b.id}/assign`, { assigneeId: cl('刘阿姨').id }, STAFF);
  assert.equal((await api('POST', `/api/me/bookings/${b.id}/accept`, null, t)).status, 409, '未完成服务不能验收');
  near(b.id);
  let r = await api('POST', `/api/merchant/bookings/${b.id}/next`, null, STAFF);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.booking.statusText, '服务中'); assert.equal(r.body.booking.status, 'arrived');
  r = await api('POST', `/api/merchant/bookings/${b.id}/next`, null, STAFF); assert.equal(r.body.booking.statusText, '待验收');
  assert.ok(await H.waitFor(() => H.R.db.prepare("SELECT 1 FROM audit_log WHERE action='notify.sms' AND target=?").get('booking:' + b.id)), '服务完成短信通知');
  const m = await api('POST', `/api/merchant/bookings/${b.id}/next`, null, OWNER); assert.equal(m.status, 409); assert.equal(m.body.error.code, 'NEED_CUSTOMER');
  assert.equal((await api('POST', `/api/merchant/bookings/${b.id}/done`, null, OWNER)).body.error.code, 'NEED_CUSTOMER');
  assert.equal((await api('POST', `/api/me/bookings/${b.id}/accept`, null, other)).status, 404, '不能验收别人的订单');
  const tiles = (await api('GET', '/api/merchant/dashboard', null, OWNER)).body.industry.tiles;
  assert.ok(tiles.find(x => x.k === '待验收').v >= 1);
  const before0 = (await api('GET', '/api/shop')).body.industry.resources.find(x => x.name === '刘阿姨').rating;
  const ac = await api('POST', `/api/me/bookings/${b.id}/accept`, null, t);
  assert.equal(ac.status, 200, JSON.stringify(ac.body)); assert.equal(ac.body.booking.status, 'done'); assert.equal(ac.body.booking.canReview, true);
  assert.equal((await api('POST', `/api/me/bookings/${b.id}/accept`, null, t)).status, 409, '不能重复验收');
  const rv = await api('POST', '/api/reviews', { bookingId: b.id, stars: 5, tags: ['打扫仔细'], text: '' }, t);
  assert.equal(rv.status, 201, JSON.stringify(rv.body));
  const after0 = (await api('GET', '/api/shop')).body.industry.resources.find(x => x.name === '刘阿姨').rating;
  assert.equal(after0.n, (before0 ? before0.n : 0) + 1, '评分记在保洁师名下');
  const list = (await api('GET', `/api/reviews?resourceId=${cl('刘阿姨').id}&limit=30`)).body;
  assert.ok(list.items.some(x => x.id === rv.body.id)); assert.ok(list.items.every(x => x.serviceName));
  assert.ok((await api('GET', '/api/merchant/audit', null, OWNER)).body.some(a => a.action === 'booking.accept'));
  void p;
});

test('超时未到：未派单的订单按规则自动记爽约；已派单的上门订单由门店处理，不自动记爽约', async () => {
  await setRule({ grace: { on: true, v: 15 }, perDay: { on: false }, maxOpen: { on: false } });
  const { t } = await regular();
  const a = (await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(2), time: '09:00' }), t)).body.booking;
  const b = (await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(2), time: '14:00' }), t)).body.booking;
  await api('POST', `/api/merchant/bookings/${b.id}/assign`, { assigneeId: cl('王阿姨').id }, OWNER);
  const s = Date.now() - 40 * 60000; for (const id of [a.id, b.id]) H.R.updateBooking(id, { start_at: s, end_at: s + 3 * 3600e3 });
  await H.B.tick();
  assert.equal(H.R.getBooking(a.id).status, 'no_show'); assert.equal(H.R.getBooking(b.id).status, 'confirmed');
  await resetRules();
});

test('价格设置：店主改价后顾客端立即按新价计算（已下单不变）；校验；店员默认无权限', async () => {
  const { t } = await regular();
  const old = (await api('POST', '/api/bookings', base(1, { hours: 3 }, { date: D(6), time: '09:00' }), t)).body.booking;
  const sv = (await api('GET', '/api/shop')).body.services.find(s => s.id === 1);
  assert.deepEqual(sv.pricing, { mode: 'hour', rate: 50, min: 3, stair: 10 });
  assert.equal((await api('PUT', '/api/merchant/services/1', { pricing: { rate: 60, min: 3, stair: 10 } }, STAFF)).status, 403);
  assert.equal((await api('PUT', '/api/merchant/services/1', { pricing: { rate: 60, min: 0, stair: 10 } }, OWNER)).status, 400);
  assert.equal((await api('PUT', '/api/merchant/services/4', { pricing: { ac: -1, hood: 1, wash: 1, stair: 10 } }, OWNER)).status, 400);
  const u = await api('PUT', '/api/merchant/services/1', { pricing: { rate: 60, min: 2, stair: 15 } }, OWNER);
  assert.equal(u.status, 200, JSON.stringify(u.body)); assert.equal(u.body.price, 60); assert.equal(u.body.pricing.mode, 'hour', '计价方式不可被改');
  assert.equal((await api('POST', '/api/quote', base(1, { hours: 2 }, { floor: 5, elev: 0 }), t)).body.price, 150, '60×2 + 2 层×15');
  assert.equal(H.R.getBooking(old.id).price_cents, 15000, '已下单订单不变');
  await api('PUT', '/api/merchant/services/1', { pricing: { rate: 50, min: 3, stair: 10 } }, OWNER);
});

test('示例数据：4 位保洁师（技能 / 评分）、今日待验收 / 服务中 / 已派单、明日待派单；看板指标', async () => {
  const ind = (await api('GET', '/api/shop')).body.industry, R = ind.resources.filter(r => r.kind === 'cleaner');
  assert.deepEqual(R.map(r => r.name), ['王阿姨', '李阿姨', '张师傅', '刘阿姨']);
  assert.ok(R.every(r => r.rating && r.rating.n >= 1)); assert.deepEqual(R.find(r => r.name === '张师傅').skillNames, ['家电', '开荒']);
  assert.equal(ind.windows.length, 2);
  const today = (await api('GET', '/api/merchant/bookings?scope=today', null, OWNER)).body;
  for (const s of ['待验收', '服务中', '已派单']) assert.ok(today.some(b => b.statusText === s), s);
  const t = (await api('GET', '/api/merchant/dashboard', null, OWNER)).body.industry.tiles;
  assert.ok(t.find(x => x.k === '待派单').v >= 2);
  const mr = (await api('GET', '/api/merchant/resources?date=' + D(0), null, STAFF)).body;
  assert.ok(mr.find(r => r.name === '张师傅').bookings.length >= 1, '档期');
});
