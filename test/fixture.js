'use strict';
// 行业测试夹具：家政（core.test.js 通过它下单）
//   上门时间窗只有 上午 09:00–12:00 / 下午 14:00–18:00，门店容量 = 4 位保洁师（按空闲人数放号）
//   basic / review = 日常保洁 3 小时，dep = 开荒保洁 80㎡（定金 ¥50）；请求体带上门地址、楼层、电梯
//   并发用例：成功数 = 该时间窗剩余名额（之前的用例可能已占用同一时间窗）
let CAP = 4;
module.exports = {
  slug: 'housekeeping', brand: '净屿家政', ownerPassword: 'jingyu2026', staffDisplay: '派单员小屿（演示）',
  serviceCount: 4, restrictedPhone: '13300006666',
  svc: { basic: 1, dep: 3, review: 1 }, depAmount: 50,
  get cap() { return CAP; },
  T: ['09:00', '14:00', '09:00', '14:00', '09:00', '14:00'],
  async body(H, tok, key, date, time) {
    const b = { serviceId: key === 'dep' ? 3 : 1, date, time, name: '测试', address: '测试小区 1 栋 101', floor: 3, elev: 1, qty: key === 'dep' ? { area: 80 } : { hours: 3 } };
    if (key === 'conc' && date && time) { const s = H.U.toMin(time); CAP = H.R.getShop().capacity - H.R.overlapCount(date, s, s === 540 ? 720 : 1080); }
    return b;
  },
  async availCheck(H, a) {
    for (const d of a.days) H.assert.ok(d.slots.length === 2 && d.slots[0].time === '09:00' && d.slots[0].end === '12:00' && d.slots[1].time === '14:00' && d.slots[1].end === '18:00', JSON.stringify(d.slots));
  },
  async assignable(H) { return H.R.listResources().find(r => r.kind === 'cleaner').id; },
};
