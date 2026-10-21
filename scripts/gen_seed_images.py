"""净屿家政 · 示例服务配图（程序绘制）。用法：python scripts/gen_seed_images.py（需要 playwright + Chrome）"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from seedimg import *
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'seed-images'
TEAL, SUN, INK = '#0AA5B8', '#FFD54A', '#2D3A40'
def broom(x, y, s, r):
    return g(f'<rect x="-8" y="-260" width="16" height="250" rx="8" fill="#C98B4E"/><path d="M-60 0 L60 0 L80 140 L-80 140Z" fill="{SUN}"/>'
             '<rect x="-64" y="-14" width="128" height="26" rx="8" fill="#E0661F"/>' + ''.join(f'<path d="M{-70 + i * 14} 40 L{-76 + i * 15} 140" stroke="#E6B93A" stroke-width="5"/>' for i in range(11)), x, y, s, r)
def spray(x, y, s, r, c=TEAL):
    return g(f'<rect x="-50" y="-40" width="100" height="190" rx="26" fill="{c}"/><rect x="-28" y="-90" width="56" height="56" rx="10" fill="#fff"/><path d="M-28 -84 L-90 -84 L-90 -64 L-28 -64Z" fill="#fff"/>'
             '<rect x="-34" y="10" width="68" height="70" rx="10" fill="#fff" opacity=".85"/><path d="M-20 30h40M-20 50h28" stroke="' + c + '" stroke-width="7" stroke-linecap="round"/>', x, y, s, r)
def bucket(x, y, s):
    return g(f'<path d="M-90 -40 L90 -40 L70 110 L-70 110Z" fill="#3CC4D3"/><ellipse cx="0" cy="-40" rx="90" ry="22" fill="#BDEFF2"/><path d="M-86 -40 Q0 -170 86 -40" stroke="{INK}" stroke-width="8" fill="none"/>', x, y, s)
def window(x, y, s):
    return g('<rect x="-150" y="-120" width="300" height="240" rx="10" fill="#fff"/><rect x="-136" y="-106" width="130" height="212" fill="#CDEFF4"/><rect x="6" y="-106" width="130" height="212" fill="#CDEFF4"/>'
             '<path d="M-120 -80 L-60 -20M-110 -40 L-80 -10M30 -70 L100 0" stroke="#fff" stroke-width="12" stroke-linecap="round"/>', x, y, s)
def house(x, y, s):
    return g(f'<path d="M-160 0 L0 -130 L160 0 V170 H-160Z" fill="#fff"/><path d="M-190 10 L0 -150 L190 10" stroke="{SUN}" stroke-width="26" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
             f'<rect x="-40" y="60" width="80" height="110" rx="8" fill="{TEAL}"/><rect x="-130" y="40" width="64" height="56" rx="6" fill="#BDEFF2"/><rect x="66" y="40" width="64" height="56" rx="6" fill="#BDEFF2"/>', x, y, s)
def ac(x, y, s):
    return g(f'<rect x="-200" y="-60" width="400" height="120" rx="24" fill="#fff"/><rect x="-170" y="20" width="340" height="14" rx="7" fill="#D9E3E8"/><circle cx="150" cy="-20" r="8" fill="{TEAL}"/>'
             '<path d="M-120 80 q-10 40 0 80M-40 80 q-10 40 0 80M40 80 q-10 40 0 80M120 80 q-10 40 0 80" stroke="#9FDDE5" stroke-width="10" fill="none" stroke-linecap="round"/>', x, y, s)
def hood(x, y, s):
    return g(f'<rect x="-40" y="-170" width="80" height="120" fill="#C9D1D6"/><path d="M-170 40 L-60 -50 H60 L170 40Z" fill="#E4E9EC"/><rect x="-170" y="40" width="340" height="30" rx="8" fill="{INK}"/>', x, y, s)
IMGS = {}
IMGS['h1_daily'] = bg('#DDF4F7', '#F5FCFD', TEAL) + house(330, 420, 1.15) + broom(760, 470, 1.15, -18) + spray(910, 470, .85, 12) + \
    ''.join(sparkle(x, y, s, SUN, .9) for x, y, s in [(560, 170, 3.2), (660, 260, 2), (180, 250, 2.4)]) + label('日常保洁 · 示例插画')
IMGS['h2_deep'] = bg('#E3EEFB', '#F6FAFE', '#2F80ED') + window(380, 380, 1.3) + spray(780, 430, 1.2, -14, '#2F80ED') + \
    bubbles([(620, 230, 34), (690, 170, 22), (560, 160, 18), (860, 220, 26)], '#fff', .9) + label('深度保洁 · 示例插画')
IMGS['h3_open'] = bg('#FCEBDF', '#FFF8F2', '#E0661F') + house(420, 430, 1.25) + bucket(840, 560, 1.0) + broom(820, 300, .8, 24) + \
    ''.join(sparkle(x, y, s, '#E0661F', .7) for x, y, s in [(200, 200, 3), (640, 160, 2.4), (960, 360, 2)]) + label('开荒保洁 · 示例插画')
IMGS['h4_appl'] = bg('#EEE9FA', '#FAF8FE', '#8E6BD8') + ac(400, 260, 1.15) + hood(760, 560, 1.0) + \
    g('<rect x="-90" y="-110" width="180" height="220" rx="18" fill="#fff"/><circle cx="0" cy="20" r="64" fill="#D8CCF3"/><circle cx="0" cy="20" r="40" fill="#fff"/><rect x="-70" y="-90" width="60" height="16" rx="8" fill="#D9E3E8"/>', 250, 560, 1.0) + \
    bubbles([(330, 470, 18), (600, 420, 24), (900, 300, 20)], '#fff', .9) + label('家电清洗 · 示例插画')
render(OUT, IMGS)
