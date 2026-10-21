'use strict';
// 测试工具（仅 e2e 截图使用）：把服务端进程时钟平移到「今天 FAKE_HM」（家政默认 11:15：可约当天下午时间窗，且距上门不足 3 小时可「开始服务」），保证任何时刻都能演示完整上门流程。
// 用法：node -r ./test/clock.js src/server.js
const hm = process.env.HK_FAKE_HM || '11:15';
if (hm && /^\d{2}:\d{2}$/.test(hm)) {
  const R = Date, [h, m] = hm.split(':').map(Number), d = new R(); d.setHours(h, m, 0, 0);
  const off = d.getTime() - R.now();
  class FakeDate extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
  global.Date = FakeDate;
}
