"""端到端测试（净屿家政）：顾客手机 + 商家后台两个独立浏览器上下文操作同一后端。
用法：用临时数据库起服务（node -r ./test/clock.js src/server.js，时钟平移到今天 11:15，保证可约当天下午并演示完整上门流程），
再 BASE=http://localhost:3201 python test/e2e.py ；SHOTS=目录 时顺便保存截图。可重复运行（每次用新手机号，改价后会恢复）"""
import os, re, random
from playwright.sync_api import sync_playwright, expect
BASE = os.environ.get('BASE', 'http://localhost:3201')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SHOTS = os.environ.get('SHOTS')
PHONE = '177' + ''.join(random.choice('0123456789') for _ in range(8))
ok = lambda m: print('ok  ', m, flush=True)
def shot(pg, name, full=False):
    if SHOTS: os.makedirs(SHOTS, exist_ok=True); pg.wait_for_timeout(400); pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())"); pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)
def confirm(pg):
    pg.wait_for_timeout(150)
    if pg.locator('.dlg [data-d="1"]').count(): pg.click('.dlg [data-d="1"]')

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    c = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    m = br.new_context(viewport={'width': 430, 'height': 900}, device_scale_factor=2).new_page()
    errs = []
    for pg in (c, m): pg.on('pageerror', lambda e: errs.append(str(e)))

    m.goto(BASE + '/#merchant'); m.fill('#m-user', 'owner'); m.fill('#m-pass', 'wrong'); m.click('[data-a=mLogin]')
    expect(m.locator('.toast')).to_contain_text('用户名或密码错误')
    m.fill('#m-pass', 'jingyu2026'); m.click('[data-a=mLogin]')
    expect(m.locator('.mhead')).to_contain_text('净屿家政'); ok('商家登录')
    expect(m.locator('.stats')).to_contain_text('待派单'); expect(m.locator('.stats')).to_contain_text('待验收')
    m.wait_for_selector('.hboard'); expect(m.locator('.hboard')).to_contain_text('张师傅'); ok('看板：待派单 / 待验收 + 保洁师档期表')
    shot(m, 'merchant_dashboard')

    # 顾客首页：服务宫格 + 保洁师评分
    c.goto(BASE + '/'); c.wait_for_selector('.tabbar')
    expect(c.locator('.hero')).to_contain_text('净屿家政'); expect(c.locator('.svc2')).to_have_count(4)
    expect(c.locator('.svc2').first).to_contain_text('¥50/小时'); expect(c.locator('.clr')).to_have_count(4); ok('首页：4 项服务（示例价）+ 4 位保洁师评分')
    shot(c, 'customer_home')
    c.evaluate("document.querySelector('.hflow').scrollIntoView({block:'start'})"); shot(c, 'customer_cleaners')
    c.click('.clr:has-text("王阿姨")'); c.wait_for_selector('.rvbox .rv, .rvbox .rvitem, .rvbox .mini')
    expect(c.locator('.pad')).to_contain_text('擅长 日常 / 深度'); ok('保洁师详情：擅长、评分、评价')
    shot(c, 'customer_cleaner_detail')

    # 登录
    c.goto(BASE + '/?r=1'); c.click('.tab:has-text("我的订单")'); c.locator('[data-a=login]').first.click()
    c.fill('#lg-phone', PHONE); c.click('[data-a=lgNext]'); c.click('[data-a=sms]')
    code = c.locator('#ab-demo-code').inner_text(timeout=5000).strip(); assert re.fullmatch(r'\d{6}', code)
    c.fill('#ab-code', code); c.click('[data-a=smsVerify]'); c.wait_for_timeout(500); ok('短信验证码登录（演示显示验证码）')

    # 下单：日常保洁 4 小时 → 今天下午 → 6 楼无电梯
    c.click('.tab:has-text("首页")'); c.click('.svc2:has-text("日常保洁")')
    expect(c.locator('.calc')).to_contain_text('¥150'); c.click('[data-a=hkStp][data-v="hours:1"]')
    expect(c.locator('.calc')).to_contain_text('4 小时 × ¥50'); expect(c.locator('#hk-ftot')).to_have_text('200'); ok('服务内容：按小时实时算价（3 小时起）')
    shot(c, 'customer_qty')
    c.click('.foot [data-a=flowNext]'); c.wait_for_selector('.win')
    expect(c.locator('.win')).to_have_count(2); expect(c.locator('.win').first).to_contain_text('上午')
    c.locator('.win:not([disabled])').first.click(); expect(c.locator('.win.on')).to_contain_text('14:00 - 18:00'); ok('上门时间窗：上午 / 下午（当天上午已截止）')
    c.evaluate("window.scrollTo(0,0);document.querySelector('.main')&&document.querySelector('.main').scrollTo(0,0)"); shot(c, 'customer_time')
    c.click('.foot [data-a=flowNext]'); c.wait_for_selector('#hk-addr')
    c.fill('#hk-addr', '示例花园 5 栋 602'); c.fill('#hk-floor', '6'); c.click('[data-a=hkElev][data-v="0"]')
    expect(c.locator('.calc')).to_contain_text('无电梯 6 楼搬运费'); expect(c.locator('.calc .tot')).to_contain_text('¥230')
    c.fill('#f-name', 'E2E 测试'); ok('地址：楼层 + 无电梯自动加收搬运费')
    shot(c, 'customer_address')
    c.click('.foot [data-a=flowNext]'); c.wait_for_selector('.ticket')
    expect(c.locator('.ticket')).to_contain_text('示例花园 5 栋 602'); expect(c.locator('.ticket')).to_contain_text('230'); expect(c.locator('.ticket')).to_contain_text('6 层 · 无电梯')
    shot(c, 'customer_confirm')
    c.click('.foot .btn[data-a=submit]'); c.wait_for_selector('.succ'); ok('提交订单：' + c.locator('.succ h2').inner_text())

    # 商家：确认 → 派单（技能不符 / 档期冲突置灰）→ 开始服务 → 服务完成
    m.goto(BASE + '/?m=1#merchant'); m.wait_for_selector('.mhead'); m.click('[data-a=mTab][data-v=disp]')
    card = m.locator(f'.card.bk:has-text("{PHONE}")').first; expect(card).to_be_visible()
    bid = card.get_attribute('data-bid')
    if card.locator('[data-a=mOp][data-v^="accept|"]').count(): card.locator('[data-a=mOp][data-v^="accept|"]').click(); confirm(m); expect(m.locator('.toast')).to_contain_text('已确认')
    card = m.locator(f'.card.bk[data-bid="{bid}"]'); card.locator('[data-a=hkAssign]').click(); m.wait_for_selector('#as-body .clr')
    expect(m.locator('#as-body .clr.off:has-text("张师傅")')).to_contain_text('不擅长日常保洁')
    expect(m.locator('#as-body .clr.off:has-text("刘阿姨")')).to_contain_text('该时段已有订单'); ok('派单：技能不符 / 该时段已有订单的保洁师置灰')
    m.click('#as-body .clr:has-text("王阿姨")'); shot(m, 'merchant_assign')
    m.click('[data-a=hkAsSave]'); expect(m.locator('.toast')).to_contain_text('已派单给 王阿姨'); ok('派单给王阿姨')
    card = m.locator(f'.card.bk[data-bid="{bid}"]'); expect(card).to_contain_text('已派单')
    card.locator(f'[data-a=mOp][data-v="next|{bid}"]').click(); expect(m.locator('.toast')).to_contain_text('已更新进度')
    expect(m.locator(f'.card.bk[data-bid="{bid}"]')).to_contain_text('服务中'); shot(m, 'merchant_dispatch')
    m.locator(f'.card.bk[data-bid="{bid}"] [data-a=mOp][data-v="next|{bid}"]').click()
    expect(m.locator(f'.card.bk[data-bid="{bid}"]')).to_contain_text('等待顾客验收'); ok('开始服务 → 服务完成（等待顾客验收）')

    # 顾客：验收并评分
    c.goto(BASE + '/?r=2'); c.click('.tab:has-text("我的订单")')
    bk = c.locator(f'.card:has([data-a=hkAccept][data-v="{bid}"])'); expect(bk).to_contain_text('王阿姨'); expect(bk).to_contain_text('待验收')
    shot(c, 'customer_orders')
    c.click('[data-a=hkFee]'); expect(c.locator('.sheet')).to_contain_text('无电梯搬运'); c.click('.sheet .sb [data-a=closeSheet]')
    bk.locator('[data-a=hkAccept]').click(); c.wait_for_selector('.bigstar')
    c.click('.bigstar [data-v="4"]'); c.click('.tgs button:has-text("准时守约")'); shot(c, 'customer_accept')
    c.click('[data-a=hkAcSave]'); expect(c.locator('.toast')).to_contain_text('验收完成'); ok('顾客验收并评分（4 星 · 准时守约）')
    c.click('.seg button:has-text("已完成")'); expect(c.locator('.card:has-text("E2E 测试")').first).to_contain_text('我的评价')

    # 价格设置：改价 → 顾客端立即生效 → 恢复
    m.goto(BASE + '/?m=2#merchant'); m.wait_for_selector('.mhead'); m.click('[data-a=mTab][data-v=price]'); m.wait_for_selector('#pr-1-rate')
    m.fill('#pr-1-rate', '60'); m.click('[data-a=hkPrSave]'); expect(m.locator('.toast')).to_contain_text('价格已保存')
    shot(m, 'merchant_price')
    c.goto(BASE + '/?r=3'); expect(c.locator('.svc2').first).to_contain_text('¥60/小时'); ok('改价后顾客端立即按新价显示')
    m.fill('#pr-1-rate', '50'); m.click('[data-a=hkPrSave]'); expect(m.locator('.toast')).to_contain_text('价格已保存')

    # 店员：手机号打码、价格只读
    s = br.new_context(viewport={'width': 430, 'height': 900}).new_page(); s.on('pageerror', lambda e: errs.append(str(e)))
    s.goto(BASE + '/#merchant'); s.fill('#m-user', 'staff'); s.fill('#m-pass', 'staff2026'); s.click('[data-a=mLogin]')
    expect(s.locator('.mhead')).to_contain_text('派单员小屿'); s.click('[data-a=mTab][data-v=all]'); s.wait_for_selector('.card.bk')
    expect(s.locator('.timeline')).not_to_contain_text(PHONE); expect(s.locator(f'.card.bk:has-text("{PHONE[:3]}****{PHONE[-4:]}")').first).to_be_visible()
    s.click('[data-a=mTab][data-v=price]'); expect(s.locator('.permnote').last).to_contain_text('修改价格需店主授权'); ok('店员：手机号打码、价格只读')
    assert not errs, errs
    ok('无前端报错')
    br.close()
print('E2E PASS')
