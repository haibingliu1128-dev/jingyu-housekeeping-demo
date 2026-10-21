/* 净屿家政 · 行业前端模块：服务内容实时算价（小时/面积/台数）、无电梯搬运费、上午/下午时间窗、上门地址、门店派单（技能/档期冲突置灰）、顾客验收评分、保洁师评分、价格设置 */
window.IND=function(Q){
var X=Q.X,S=Q.S,V=Q.V,I=Q.I,esc=Q.esc,api=Q.api;
I.wallet2='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/></svg>';
var BROOM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l-4 9"/><path d="M6.5 12h8l2.5 9H4z"/><path d="M8 16.5l-.5 4.5M11 16.5v4.5M14 16.5l.5 4.5"/></svg>';
var SVI={hour:BROOM,area:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/><path d="M17.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/></svg>',
  unit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="8" rx="2"/><path d="M6 10h12M7 16c0 2 1 3 1 3M12 16v3M17 16c0 2-1 3-1 3"/></svg>'};
var SVC=['#0AA5B8','#2F80ED','#E0661F','#8E6BD8'];
var HOUSE='<svg class="house" viewBox="0 0 132 110"><path d="M20 56L66 20l46 36v46H20z" fill="#fff" opacity=".95"/><path d="M12 60L66 16l54 44" stroke="#FFD54A" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="54" y="68" width="24" height="34" rx="3" fill="#0AA5B8" opacity=".85"/><rect x="30" y="64" width="16" height="14" rx="2" fill="#BDEFF2"/><rect x="86" y="64" width="16" height="14" rx="2" fill="#BDEFF2"/><g fill="#FFD54A"><path d="M110 22l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/><path d="M22 28l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g></svg>';
function P(){return Q.C.industry||{}}
function AP(){return P().appliances||[['ac','空调（挂机）'],['hood','油烟机'],['wash','洗衣机（滚筒/波轮）']]}
function pr(s){return (s&&s.pricing)||{}}
function mode(s){return pr(s).mode||'fixed'}
function cur(){return Q.svcById(S.sel.serviceId)}
function sIdx(s){var L=Q.C.services;for(var i=0;i<L.length;i++)if(L[i].id===s.id)return i;return 0}
function svIcon(s){var c=SVC[sIdx(s)%4];return '<span class="hic" style="background:'+c+'1A;color:'+c+'">'+(SVI[mode(s)]||BROOM)+'</span>'}
function fromPrice(s){var p=pr(s),m=mode(s);return m==='hour'?'¥'+p.rate+'/小时':m==='area'?'¥'+p.rate+'/㎡':m==='unit'?'¥'+Math.min(p.ac,p.hood,p.wash)+'/台起':'¥'+s.price}
function subText(s){var p=pr(s),m=mode(s);return m==='hour'?p.min+' 小时起':m==='area'?p.min+'㎡起算':m==='unit'?'按台计费':''}
/* 本地记住常用地址（演示：存浏览器本地） */
var LS='jingyu_addr',LAST={floor:'',elev:true};try{var _l=JSON.parse(localStorage.getItem(LS)||'null');if(_l)LAST=_l}catch(e){}
function hk(){var o=S.sel.opts;if(!o.hk){var s=cur(),m=mode(s);o.hk={q:m==='hour'?{hours:pr(s).min||3}:m==='unit'?{ac:1,hood:0,wash:0}:m==='area'?{area:''}:{},floor:LAST.floor||'',elev:LAST.elev!==false,sid:s&&s.id};if(!S.sel.address&&LAST.addr)S.sel.address=LAST.addr}
  else if(o.hk.sid!==S.sel.serviceId){delete o.hk;return hk()}return o.hk}
/* 与服务端相同的计价规则（预估，以服务端为准） */
function calc(s,h){var p=pr(s),m=mode(s),q=h.q||{},L=[];
  if(m==='hour'){var hh=+q.hours||0,ch=Math.max(hh,p.min||1);if(hh)L.push([s.name+' '+ch+' 小时 × ¥'+p.rate+(hh<ch?'（'+p.min+' 小时起）':''),ch*p.rate])}
  else if(m==='area'){var a=Math.round(+q.area||0),ca=Math.max(a,p.min||0);if(a>=10)L.push([s.name+' '+ca+'㎡ × ¥'+p.rate+(a<ca?'（'+p.min+'㎡起）':''),ca*p.rate])}
  else if(m==='unit')AP().forEach(function(x){var n=+q[x[0]]||0;if(n)L.push([x[1]+' × '+n,n*p[x[0]]])});
  else L.push([s.name,s.price]);
  var fl=parseInt(h.floor,10)||0,st=p.stair!=null?p.stair:10;if(!h.elev&&fl>=4)L.push(['无电梯 '+fl+' 楼搬运费（'+(fl-3)+' 层 × ¥'+st+'）',(fl-3)*st]);
  return {lines:L,total:L.reduce(function(a,l){return a+l[1]},0)}}
function calcBox(s,h){var c=calc(s,h);return '<div class="calc" id="calc">'+(c.lines.length?c.lines.map(function(l){return '<div class="ln"><span>'+esc(l[0])+'</span><span>¥'+l[1]+'</span></div>'}).join(''):'<div class="ln"><span>请填写服务数量</span><span>—</span></div>')+'<div class="tot"><span>预估总价（示例价）</span><b>¥'+c.total+'</b></div></div>'}
function qtext(s,q){var m=mode(s);q=q||{};return m==='hour'?q.hours+' 小时':m==='area'?q.area+'㎡':m==='unit'?AP().filter(function(x){return q[x[0]]}).map(function(x){return x[1].replace(/（.*）/,'')+'×'+q[x[0]]}).join('、'):''}
function stp(k,v,min,max){return '<div class="stp"><button data-a="hkStp" data-v="'+k+':-1"'+(v<=min?' disabled':'')+' aria-label="减少">−</button><span>'+v+'</span><button data-a="hkStp" data-v="'+k+':1"'+(v>=max?' disabled':'')+' aria-label="增加">+</button></div>'}
function cav(r,big){var hair=['M15 22c-1-9 4-14 9-14s10 5 9 14c-2-4-5-6-9-6s-7 2-9 6z','M14 26c-2-12 3-18 10-18s12 6 10 18l-2-8c-4 2-12 2-16 0z','M15 20c0-7 4-11 9-11s9 4 9 11c-3-2-6-3-9-3s-6 1-9 3z','M13 24c-1-10 4-16 11-16s12 6 11 16c-1-3-3-6-5-7-4 2-8 2-12 0-2 1-4 4-5 7z'][(r.avatar||0)%4];
  return '<div class="cav'+(big?' lg':'')+'"><svg viewBox="0 0 48 48"><rect width="48" height="48" fill="'+esc(r.color||'#E2F6F8')+'"/><path d="M8 48c1-9 8-13 16-13s15 4 16 13z" fill="#0AA5B8"/><path d="M18 40h12v8H18z" fill="#fff" opacity=".85"/><path d="M20 32h8v5h-8z" fill="#F1D3BC"/><ellipse cx="24" cy="23" rx="9" ry="10" fill="#F4DCC6"/><path d="'+hair+'" fill="#3A2F2A"/><circle cx="20.5" cy="24" r="1.1" fill="#3A2F2A"/><circle cx="27.5" cy="24" r="1.1" fill="#3A2F2A"/><path d="M21.5 28.5c1.5 1 3.5 1 5 0" stroke="#C7705A" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg></div>'}
function cleaners(){return (P().resources||[]).filter(function(r){return r.kind==='cleaner'&&r.active!==false})}
function rateTxt(r){return r.rating&&r.rating.n?'★ '+r.rating.avg.toFixed(1):'★ 新'}
function hm2(t){return t}

Object.assign(X,{
  brand:'净屿家政',brandSub:'上门保洁 · 家电清洗 · 在线算价',heroTags:['价格先算清','上午/下午可约','验收后评价'],avatar:'屿',member:'净屿用户',ownerPwd:'jingyu2026',
  tabs:[['home','首页',I.home,I.homeF],['book','下单',I.cal,I.calF],['mine','我的订单',I.user,I.userF]],
  flow:['book','hqty','time','info','confirm'],stepNames:['选服务','服务内容','上门时间','地址','确认'],
  bookTitle:'选择服务',svcTitle:'上门服务',hotTitle:'上门服务',timeWord:'上门时间',notePh:'选填：如 家有宠物、需自带梯子',svcPh:'擦玻璃',staffPh:'保洁师小周',
  assLabel:'保洁师',demoPayWord:'与定金支付',confirmTitle:'确认订单',openSub:'上门服务 · 上午 / 下午两个时间窗',
  notice:'保洁师将在所选时间窗内上门；服务完成后请在「我的订单」验收并评分；',
  heroArt:function(){return HOUSE},
  quick:[['startBook','',BROOM,'立即下单','#E2F6F8','#0AA5B8'],['tab','mine',I.list,'我的订单','#EAF3FD','#2F80ED'],['callShop','',I.phone,'联系门店','#FFF6D6','#B8860B'],['toMerchant','',I.shop,'商家后台','#FEF1E8','#E0661F']],
  svcMeta:function(s){return '<span class="price">'+fromPrice(s).replace('¥','')+'</span><span class="chip">'+esc(subText(s))+'</span>'},
  estimate:function(s){if(!s||S.view==='book')return null;var h=S.sel.opts.hk;if(!h||h.sid!==s.id)return null;var c=calc(s,h);return c.lines.length?{price:c.total,duration:s.duration}:null},
  homeSvcs:function(){return '<div class="sec-t">上门服务<small>选服务、填数量，价格马上算出来</small></div><div class="svgrid">'+Q.C.services.map(function(s){return '<button class="svc2" data-a="quickBook" data-v="'+s.id+'">'+svIcon(s)+'<b>'+esc(s.name)+'</b><small>'+esc(s.desc||'')+'</small><div class="pr">'+fromPrice(s)+' <span class="demo-tag">示例价</span></div></button>'}).join('')+'</div>'},
  homeMid:function(){return ''},
  homeExtra:function(){var st=P().steps||[];return '<div class="sec-t">服务流程</div><div class="card"><div class="hflow">'+['下单','派单'].concat(st.slice(1).map(function(x){return x.label==='已完成'?'评价':x.label})).map(function(x){return '<div class="d"><i></i>'+esc(x)+'</div>'}).join('')+'</div></div>'+
    '<div class="sec-t">保洁师<small>评分来自顾客验收后的评价</small></div>'+cleaners().map(function(r){return '<button class="clr" data-a="hkCleaner" data-v="'+r.id+'">'+cav(r)+'<div class="g"><b>'+esc(r.name)+'</b> <span class="rate">'+rateTxt(r)+'</span><div class="mini">'+esc(r.title||'')+(r.rating&&r.rating.n?' · '+r.rating.n+' 次评分':'')+'</div><div class="tagsx">'+(r.skillNames||r.tags||[]).map(function(t){return '<span>'+esc(t)+'</span>'}).join('')+'</div></div>'+I.right+'</button>'}).join('')},
  timeTop:function(s){var h=hk();return '<div class="notice" style="margin-top:0">按空闲保洁师人数放号；当天时间窗需提前 2 小时预约。'+(calc(s,h).lines.length?'本单预估 <b class="price" style="font-size:13px">'+calc(s,h).total+'</b>':'')+'</div>'},
  infoTop:function(){var h=hk(),e=S.errs;return '<div class="sec-t" style="margin-top:0">上门地址</div><div class="card" style="padding:2px 14px">'+
    '<div class="field'+(e.addr?' bad':'')+'"><label>服务地址</label><input id="hk-addr" maxlength="40" placeholder="小区 / 楼栋 / 门牌号" value="'+esc(S.sel.address||'')+'"></div>'+(e.addr?'<div class="err">'+e.addr+'</div>':'')+
    '<div class="field'+(e.floor?' bad':'')+'"><label>楼层</label><input id="hk-floor" type="tel" inputmode="numeric" maxlength="2" placeholder="如 12" value="'+esc(h.floor)+'"><span class="unit">层</span></div>'+(e.floor?'<div class="err">'+e.floor+'</div>':'')+
    '<div class="field"><label>电梯</label><div class="segs"><button class="'+(h.elev?'on':'')+'" data-a="hkElev" data-v="1">有电梯</button><button class="'+(h.elev?'':'on')+'" data-a="hkElev" data-v="0">无电梯</button></div></div></div>'+
    '<div class="mini" style="padding:6px 4px 2px">无电梯且 4 层及以上，按楼层加收搬运费（示例规则）</div>'+calcBox(cur(),h)+'<div class="sec-t">联系人</div>'},
  beforeNext:function(v){var s=cur();
    if(v==='hqty'){var h=hk(),m=mode(s);if(m==='area'&&!(+h.q.area>=10&&+h.q.area<=2000)){S.errs={area:'请输入面积（10–2000㎡）'};Q.render(false);return false}
      if(m==='unit'&&!AP().some(function(x){return h.q[x[0]]>0})){Q.toast('请至少选择 1 台家电');return false}S.errs={}}
    if(v==='info'){var h2=hk(),e={};readInfo();if((S.sel.address||'').trim().length<4)e.addr='请填写详细地址（4 字以上）';if(!(+h2.floor>=1&&+h2.floor<=99))e.floor='请填写楼层';
      if(Object.keys(e).length){S.errs=e;Q.render(false);return false}LAST={addr:S.sel.address.trim(),floor:h2.floor,elev:h2.elev};try{localStorage.setItem(LS,JSON.stringify(LAST))}catch(x){}}},
  bodyExtra:function(b){var h=S.sel.opts.hk;if(!h)return;b.qty=h.q;b.floor=+h.floor;b.elev=h.elev?1:0;b.address=(S.sel.address||'').trim()},
  confirmRows:function(){var s=cur(),h=hk();return '<div class="kv"><span>服务内容</span><span>'+esc(qtext(s,h.q))+'</span></div><div class="kv"><span>上门地址</span><span style="max-width:65%;text-align:right">'+esc(S.sel.address||'')+'</span></div><div class="kv"><span>楼层</span><span>'+esc(h.floor)+' 层 · '+(h.elev?'有电梯':'无电梯')+'</span></div>'},
  successText:function(b){return '门店派单后会显示保洁师信息；服务完成后请在「我的订单」验收并评分'},
  rows:function(b,merchant){var x=(b.extra||{}).hk;if(!x)return '';return '<div class="row">'+BROOM.replace('<svg','<svg width="15" height="15"')+esc(x.qtext||'')+(b.windowLabel?' · '+esc(b.windowLabel)+'上门':'')+'</div><div class="row">'+I.pin+esc(b.address||'')+' · '+x.floor+'层'+(x.elev?'':' · 无电梯')+'</div>'},
  cops:function(b){if(b.status==='confirmed'&&b.progress==='assigned')return '<span class="mini" style="margin-right:auto">已派单，如需取消请联系门店</span><button class="btn sm gray" data-a="callShop">联系门店</button>';
    if(b.status==='arrived'&&b.progress==='check')return '<span class="mini" style="margin-right:auto">保洁师已完成服务</span><button class="btn sm" data-a="hkAccept" data-v="'+b.id+'">验收并评分</button>';
    if(b.status==='arrived')return '<span class="mini">服务进行中</span>';return null},
  mineCells:function(){return '<button class="cell" data-a="hkFee"><span class="ic">'+I.wallet2+'</span><span class="t">收费说明</span><span class="arrow">'+I.right+'</span></button>'+(LAST.addr?'<button class="cell" data-a="hkAddr"><span class="ic">'+I.pin+'</span><span class="t">常用地址<small class="muted" style="margin-left:6px">'+esc(LAST.addr)+'</small></span><span class="arrow">'+I.right+'</span></button>':'')},
  /* ---------- 商家 ---------- */
  progressInMerchant:true,
  mTiles:function(){return '<button data-a="mTab" data-v="price"><span class="qi" style="background:#FFF6D6;color:#B8860B">'+I.edit+'</span><div><b>价格设置</b><span>单价 / 起步 / 搬运费</span></div></button>'},
  mTop:function(){return '<div class="sec-t">保洁师档期<small>今明两天 · 上午 / 下午</small></div><div class="card" style="padding:6px 12px">'+(MR?board():Q.loading())+'</div>'},
  mHomeLoad:function(){var d0=Q.today(),d1=Q.ymd(Q.addDays(Q.parseYmd(d0),1));return Promise.all([api('GET','/api/merchant/resources?date='+d0,null,'m'),api('GET','/api/merchant/resources?date='+d1,null,'m')]).then(function(r){MR={d:[d0,d1],r:r}},function(){MR=null})},
  mTabs:[['disp','派单台'],['today','今日上门'],['all','全部订单'],['price','价格设置']],
  mTabLoad:{disp:function(){return api('GET','/api/merchant/bookings?scope=upcoming',null,'m')},price:function(){return Q.loadShop().then(function(){return []})}},
  mList:{disp:function(){var L=(Q.M.list||[]),w=L.filter(function(b){return b.status==='pending'||b.status==='awaiting_payment'||(b.status==='confirmed'&&!b.assigneeId)}),o=L.filter(function(b){return w.indexOf(b)<0});
      var srt=function(a,b){return a.startAt-b.startAt};w.sort(srt);o.sort(srt);
      return '<div class="sec-t">待确认 / 待派单 '+w.length+'</div>'+(w.length?w.map(mcard).join(''):Q.emptyBox('没有待派单的订单',false))+(o.length?'<div class="sec-t">已派单 / 服务中 '+o.length+'</div>'+o.map(mcard).join(''):'')},
    price:function(){return priceForm()}},
  mops:function(b){if(!Q.can('booking.handle'))return '';var h='',past=b.startAt<=Date.now();
    if(b.status==='pending'||b.status==='awaiting_payment')return null;
    if(b.status==='confirmed'&&!b.assigneeId)h='<button class="btn sm gray" data-a="mOp" data-v="cancel|'+b.id+'">取消</button>'+(past?'<button class="abb r" data-a="mOp" data-v="noshow|'+b.id+'">标记爽约</button>':'')+'<button class="btn sm" data-a="hkAssign" data-v="'+b.id+'">派单</button>';
    else if(b.status==='confirmed')h='<button class="btn sm gray" data-a="mOp" data-v="cancel|'+b.id+'">取消</button><button class="btn sm ghost" data-a="hkAssign" data-v="'+b.id+'">改派</button><button class="btn sm" data-a="mOp" data-v="next|'+b.id+'">开始服务</button>';
    else if(b.status==='arrived'&&b.progress==='serving')h='<button class="btn sm" data-a="mOp" data-v="next|'+b.id+'">服务完成</button>';
    else if(b.status==='arrived'&&b.progress==='check')h='<span class="mini">等待顾客验收</span>';
    return h},
  mviews:['hcleaner'],liveViews:['hcleaner','hqty'],
  onBookErr:function(e){if(['BAD_QTY','BAD_FLOOR','NEED_ADDRESS'].indexOf(e.code)>=0){Q.alertBox('请检查订单信息',e.message);return true}}
});
var MR=null;
function mcard(b){return '<div class="card bk'+(Q.stClass(b)==='cancelled'?' dim':'')+'" data-bid="'+b.id+'">'+Q.bookingInner(b,true,true)+'</div>'}
function board(){var W=[[540,'上午'],[840,'下午']];
  return '<table class="hboard"><tr><th>保洁师</th>'+MR.d.map(function(d){return '<th colspan="2">'+(d===Q.today()?'今天':'明天')+' '+Q.md(d)+'</th>'}).join('')+'</tr><tr><td></td>'+MR.d.map(function(){return W.map(function(w){return '<td class="wl">'+w[1]+'</td>'}).join('')}).join('')+'</tr>'+
  MR.r[0].map(function(r,i){return '<tr><td class="nm">'+esc(r.name)+'</td>'+MR.r.map(function(day){var rr=day.filter(function(x){return x.id===r.id})[0]||{bookings:[]};return W.map(function(w){var b=rr.bookings.filter(function(x){return x.assigneeId===r.id&&['confirmed','arrived'].indexOf(x.status)>=0&&x.time===Q.pad(w[0]/60)+':00'})[0];
    return '<td><span class="slotb'+(b?' on':'')+'">'+(b?esc(b.serviceName.slice(0,2)):'空')+'</span></td>'}).join('')}).join('')+'</tr>'}).join('')+'</table>'}
function priceForm(){var L=Q.C.services.filter(function(s){return mode(s)!=='fixed'}),ed=Q.can('service.manage');
  var F={hour:[['rate','元/小时'],['min','起步（小时）']],area:[['rate','元/㎡'],['min','起算面积（㎡）']],unit:AP().map(function(x){return [x[0],x[1].replace(/（.*）/,'')+'（元/台）']})};
  return (ed?'':'<div class="permnote">修改价格需店主授权「管理服务与图片」，当前仅可查看。</div>')+L.map(function(s){return '<div class="card"><div class="row2">'+svIcon(s)+'<b>'+esc(s.name)+'</b></div>'+F[mode(s)].map(function(f){return '<div class="irow"><span>'+esc(f[1])+'</span><input class="pr-in" id="pr-'+s.id+'-'+f[0]+'" type="number" inputmode="numeric" value="'+pr(s)[f[0]]+'"'+(ed?'':' disabled')+'></div>'}).join('')+'</div>'}).join('')+
    '<div class="card"><div class="irow"><span>无电梯搬运（元/层，4 层起）</span><input class="pr-in" id="pr-stair" type="number" inputmode="numeric" value="'+(L[0]?pr(L[0]).stair:10)+'"'+(ed?'':' disabled')+'></div></div>'+
    (ed?'<button class="btn" style="width:100%" data-a="hkPrSave">保存价格</button>':'')+'<div class="mini" style="margin:8px 0 14px;text-align:center">修改后顾客端立即按新价格计算（已下单订单不变）</div>'}
function readInfo(){var a=document.getElementById('hk-addr'),f=document.getElementById('hk-floor');if(a)S.sel.address=a.value;if(f)hk().floor=f.value.replace(/\D/g,'').slice(0,2)}
document.addEventListener('input',function(e){var id=e.target&&e.target.id;
  if(id==='hk-addr'||id==='hk-floor'){readInfo();if(id==='hk-floor')liveCalc()}
  if(id==='hk-area'){hk().q.area=e.target.value.replace(/\D/g,'').slice(0,4);liveCalc()}});
function liveCalc(){var b=document.getElementById('calc'),s=cur();if(b&&s){b.outerHTML=calcBox(s,hk());var f=document.getElementById('hk-ftot');if(f)f.textContent='¥'+calc(s,hk()).total}}

/* ---------- 顾客：服务内容 ---------- */
V.hqty=function(){var s=cur();if(!s)return V.book();var h=hk(),p=pr(s),m=mode(s),body,e=S.errs||{};
  if(m==='hour')body='<div class="card"><div class="irow"><div><b>服务时长</b><div class="mini">¥'+p.rate+'/小时 · '+p.min+' 小时起</div></div>'+stp('hours',h.q.hours,1,8)+'</div><div class="mini">参考：两居室日常打扫约 3–4 小时</div></div>';
  else if(m==='unit')body='<div class="card">'+AP().map(function(x){return '<div class="irow"><div><b>'+esc(x[1])+'</b><div class="mini">¥'+p[x[0]]+'/台</div></div>'+stp(x[0],h.q[x[0]]||0,0,6)+'</div>'}).join('')+'</div>';
  else if(m==='area')body='<div class="card" style="padding:2px 14px"><div class="field'+(e.area?' bad':'')+'"><label>房屋面积</label><input id="hk-area" type="tel" inputmode="numeric" maxlength="4" placeholder="输入建筑面积" value="'+esc(h.q.area)+'"><span class="unit">㎡</span></div>'+(e.area?'<div class="err">'+e.area+'</div>':'')+'</div><div class="mini" style="padding:6px 4px">¥'+p.rate+'/㎡ · '+p.min+'㎡起算'+(sIdx(s)===2?' · 含玻璃、地面胶渍清理':' · 含厨房油污、卫生间水垢')+'</div>';
  else body='<div class="card"><div class="mini">该服务按项目计价，无需填写数量。</div></div>';
  var c=calc(s,h);
  return {nav:Q.nav(esc(s.name),{back:true}),body:Q.steps('hqty')+'<div class="pad"><div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 12px">'+Q.thumb(s)+'<div style="flex:1"><b>'+esc(s.name)+'</b><div class="mini">'+esc(s.desc||'')+'</div></div></div>'+body+calcBox(s,h)+'<div class="mini" style="padding:2px 4px">无电梯 4 层及以上加收搬运费，下一步填写地址后自动计算。</div></div>',
    foot:'<div class="foot"><div class="sum">预估<br><b class="price" id="hk-ftot" style="font-size:18px">'+c.total+'</b></div><button class="btn" data-a="flowNext">下一步</button></div>'}};
X.act.hkStp=function(v){var a=v.split(':'),q=hk().q;q[a[0]]=(+q[a[0]]||0)+(+a[1]);S.quote=null;Q.render(false)};
X.act.hkElev=function(v){readInfo();hk().elev=v==='1';S.quote=null;Q.render(false)};
X.act.hkCleaner=function(v){S.hcl=+v;CR=null;Q.go('hcleaner')};
var CR=null;
X.enter.hcleaner=function(){api('GET','/api/reviews?resourceId='+S.hcl+'&limit=10').then(function(r){CR=r;if(S.view==='hcleaner')Q.render(false)},function(){})};
V.hcleaner=function(){var r=cleaners().filter(function(x){return x.id===S.hcl})[0];if(!r)return {nav:Q.nav('保洁师',{back:true}),body:Q.loading()};
  return {nav:Q.nav('保洁师',{back:true}),body:'<div class="pad"><div class="card row2">'+cav(r,true)+'<div class="g"><b style="font-size:18px">'+esc(r.name)+'</b><span class="demo-tag">示例</span><div class="mini">'+esc(r.title||'')+' · 擅长 '+(r.skillNames||[]).map(esc).join(' / ')+'</div><div class="rate" style="margin-top:4px;font-size:16px">'+rateTxt(r)+' <span class="mini" style="font-weight:400">'+(r.rating?r.rating.n:0)+' 次评分</span></div></div></div>'+
  (r.intro?'<div class="card"><b>简介</b><div class="mini" style="margin-top:6px;font-size:13px">'+esc(r.intro)+'</div></div>':'')+
  '<div class="card"><b>顾客评价标签</b><div class="tagsx" style="margin-top:8px">'+(r.rating&&r.rating.tags&&r.rating.tags.length?r.rating.tags.map(function(t){return '<span>'+esc(t)+'</span>'}).join(''):'<span class="mini">暂无</span>')+'</div><div class="mini" style="margin-top:8px">评分仅来自顾客验收后的星级与标签（演示数据）。</div></div>'+
  '<div class="card rvbox"><b>最近评价</b>'+(!CR?Q.loading():CR.items.length?CR.items.map(function(x){return Q.reviewItem(x)}).join(''):'<div class="mini" style="padding:8px 0">暂无评价</div>')+'</div>'+
  '<button class="btn" style="width:100%" data-a="startBook">预约上门服务</button></div>'}};
/* 顾客验收 + 评分 */
var AC=null;
function acBody(){var F=Q.F(),b=Q.findB(AC.id),tags=(F.tagsPos||[]);
  return '<div class="mini" style="text-align:center">'+(b&&b.assigneeName?'为保洁师 '+esc(b.assigneeName)+' 打分':'为本次服务打分')+'，评分记在保洁师名下</div><div class="bigstar">'+[1,2,3,4,5].map(function(i){return '<button class="'+(i<=AC.stars?'on':'')+'" data-a="hkStar" data-v="'+i+'" aria-label="'+i+' 星">★</button>'}).join('')+'</div>'+
    '<div class="tgs">'+(AC.stars>=4?tags:(F.tagsNeg||[]).concat(tags)).map(function(t){return '<button class="'+(AC.tags.indexOf(t)>=0?'on':'')+'" data-a="hkTag" data-v="'+esc(t)+'">'+esc(t)+'</button>'}).join('')+'</div>'+
    '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn gray" style="flex:1" data-a="closeSheet">稍后</button><button class="btn" style="flex:2" data-a="hkAcSave">确认验收</button></div>'}
function acRender(){var el=document.getElementById('ac-body');if(el)el.innerHTML=acBody()}
X.act.hkAccept=function(v){AC={id:+v,stars:5,tags:[]};Q.sheet('验收服务','<div id="ac-body">'+acBody()+'</div>')};
X.act.hkStar=function(v){AC.stars=+v;acRender()};
X.act.hkTag=function(v){var i=AC.tags.indexOf(v);i>=0?AC.tags.splice(i,1):AC.tags.push(v);acRender()};
X.act.hkAcSave=function(){var id=AC.id,F=Q.F();api('POST','/api/me/bookings/'+id+'/accept',null,'c').then(function(){
    return F.review?api('POST','/api/reviews',{bookingId:id,stars:AC.stars,tags:AC.tags,text:''},'c').then(function(r){return r},function(){return null}):null}).then(function(r){Q.closeSheet();Q.toast(r&&r.status==='pending'?'验收完成，评价待门店审核后公开':'验收完成，感谢评分');Q.onEnter(S.view)},Q.fail)};
/* 商家：派单 */
var AS=null;
function asBody(){var b=AS.b;return '<div class="mini" style="margin-bottom:10px">'+esc(b.serviceName)+' · '+Q.dateLabel(b.date)+' '+esc(b.windowLabel||b.time)+' · '+esc(b.address||'')+'</div>'+(!AS.res?Q.loading():AS.res.map(function(r){
    var busy=r.bookings.filter(function(x){return x.id!==b.id&&x.assigneeId===r.id&&['confirmed','arrived'].indexOf(x.status)>=0&&x.time===b.time})[0],sk=(r.skills||[]).indexOf(b.serviceId)>=0,dis=busy||!sk;
    return '<button class="clr'+(dis?' off':'')+(AS.cid===r.id?' on':'')+'" data-a="hkAsPick" data-v="'+r.id+'"'+(dis?' disabled':'')+'>'+cav(r)+'<div class="g"><b>'+esc(r.name)+'</b> <span class="rate">'+rateTxt(r)+'</span><div class="mini">'+(!sk?'不擅长'+esc(b.serviceName):busy?'该时段已有订单（'+esc(busy.serviceName)+'）':'空闲 · 擅长 '+(r.skillNames||[]).map(esc).join('/'))+'</div></div>'+(AS.cid===r.id?'<span class="pick">'+I.check+'</span>':'')+'</button>'}).join(''))+
  '<div style="display:flex;gap:10px;margin-top:10px"><button class="btn gray" style="flex:1" data-a="closeSheet">取消</button><button class="btn" style="flex:2" data-a="hkAsSave">确认派单</button></div>'}
function asRender(){var el=document.getElementById('as-body');if(el)el.innerHTML=asBody()}
X.act.hkAssign=function(v){var b=Q.findB(v);if(!b)return;AS={b:b,cid:b.assigneeId||null,res:null};Q.sheet('选择保洁师','<div id="as-body">'+asBody()+'</div>');
  api('GET','/api/merchant/resources?date='+b.date,null,'m').then(function(r){AS.res=r;asRender()},Q.fail)};
X.act.hkAsPick=function(v){AS.cid=+v;asRender()};
X.act.hkAsSave=function(){if(!AS.cid){Q.toast('请选择保洁师');return}var r=AS.res.filter(function(x){return x.id===AS.cid})[0];
  api('POST','/api/merchant/bookings/'+AS.b.id+'/assign',{assigneeId:AS.cid},'m').then(function(){Q.closeSheet();Q.toast('已派单给 '+r.name);Q.mLoad(S.view)},Q.fail)};
/* 商家：价格设置 */
X.act.hkPrSave=function(){var L=Q.C.services.filter(function(s){return mode(s)!=='fixed'}),st=+document.getElementById('pr-stair').value,bad=false;
  var reqs=L.map(function(s){var p={stair:st};[].slice.call(document.querySelectorAll('[id^="pr-'+s.id+'-"]')).forEach(function(e){var k=e.id.split('-')[2],n=e.value===''?NaN:Math.round(+e.value);if(!(n>=0&&n<=9999))bad=true;p[k]=n});return [s.id,p]});
  if(bad||!(st>=0&&st<=999)){Q.toast('请输入有效的整数价格');return}
  reqs.reduce(function(pm,x){return pm.then(function(){return api('PUT','/api/merchant/services/'+x[0],{pricing:x[1]},'m')})},Promise.resolve()).then(function(){Q.toast('价格已保存');return Q.loadShop()}).then(function(){Q.render(false)},Q.fail)};
function feeHtml(){var L=Q.C.services.filter(function(s){return mode(s)!=='fixed'});
  return '<div class="card">'+L.map(function(s){return '<div class="kv"><span>'+esc(s.name)+'</span><span>'+fromPrice(s)+(subText(s)?'，'+esc(subText(s)):'')+'</span></div>'}).join('')+(L[0]?'<div class="kv"><span>无电梯搬运</span><span>4 层起每层 ¥'+pr(L[0]).stair+'</span></div>':'')+'</div><div class="mini" style="margin-bottom:10px">示例价格，以下单页实时计算为准；服务完成验收后线下结算（演示）。</div>'}
X.act.hkFee=function(){Q.sheet('收费说明（示例）',feeHtml()+'<button class="btn" style="width:100%" data-a="closeSheet">知道了</button>')};
X.act.hkAddr=function(){Q.sheet('常用地址','<div class="card"><div class="kv"><span>地址</span><span>'+esc(LAST.addr)+'</span></div><div class="kv"><span>楼层</span><span>'+esc(LAST.floor)+' 层 · '+(LAST.elev?'有电梯':'无电梯')+'</span></div></div><div class="mini" style="margin-bottom:10px">下单时自动带出，可在「地址」步骤修改（保存在本机浏览器）。</div><button class="btn" style="width:100%" data-a="closeSheet">知道了</button>')};
X.enter.home=function(){if(Q.ME.token)Q.loadMine().then(function(){if(S.view==='home')Q.render(false)},function(){})};
};
