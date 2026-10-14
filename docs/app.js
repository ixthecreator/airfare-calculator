'use strict';
const $ = id => document.getElementById(id);
const { number, calculate } = airfareCost;
const key = 'airfare-cost-v2';
const tripDefaults = {origin:'',destination:'',tripType:'oneway',travelers:'1',children:'0',infantsSeat:'0',infantsLap:'0',returnFlight:'',depart:'',returnDate:'',cabin:'经济舱',flight:'',segments:''};
const initial = () => ({miles:'60000',price:'1.4',priceUnit:'cpp',tax:'50',taxCurrency:'USD',cash:'1200',cashCurrency:'USD',fx:'7',fxMode:'sample',fxDate:'',fetchedAt:'',manualAt:'',basis:'same',sample:true,presets:[],trip:{...tripDefaults}});
let state = initial();
let storageFailed = false;
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const k of ['miles','price','tax','cash','fx','fxDate','fetchedAt','manualAt']) if (typeof saved[k] === 'string') state[k] = saved[k].slice(0,100);
    for (const [k, options] of Object.entries({priceUnit:['cpp','cny'],taxCurrency:['USD','CNY'],cashCurrency:['USD','CNY'],fxMode:['auto','manual','sample'],basis:['same','alternative']})) if (options.includes(saved[k])) state[k] = saved[k];
    state.sample = saved.sample === true;
    if (Array.isArray(saved.presets)) state.presets = saved.presets.filter(p => p && typeof p.name === 'string' && ['cpp','cny'].includes(p.unit) && number(p.value) !== null).slice(0,8).map(p => ({name:p.name.slice(0,24),unit:p.unit,value:String(p.value).slice(0,100)}));
    if (saved.trip && typeof saved.trip === 'object') for (const k of Object.keys(tripDefaults)) if (typeof saved.trip[k] === 'string') state.trip[k] = saved.trip[k].slice(0,1000);
  }
} catch { storageFailed = true; }
let fxRequest = 0;
let fxBusy = false;
let fxFailure = false;
const fmt = (v, decimals = 2) => new Intl.NumberFormat('zh-CN',{maximumFractionDigits:decimals}).format(v);
const money = (v, currency) => new Intl.NumberFormat('zh-CN',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const dual = (usd, fx) => `${money(usd * fx,'CNY')} CNY\n${money(usd,'USD')} USD`;
const editable = value => Number.isFinite(value) ? String(Number(value.toFixed(8))) : '';
function save() {
  try { localStorage.setItem(key,JSON.stringify(state)); storageFailed = false; }
  catch { storageFailed = true; }
  $('storage').textContent = storageFailed ? '浏览器无法保存输入；本次计算仍可使用。' : '输入自动保存在当前浏览器 · 核心计算可离线使用';
}
function dateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN',{hour12:false});
}
function fxStatus() {
  let status = state.fxMode === 'manual' ? `手动汇率 · 设置于 ${dateTime(state.manualAt)}` : state.fxMode === 'auto' ? `参考汇率 · 数据日期 ${state.fxDate} · 获取于 ${dateTime(state.fetchedAt)}` : '示例汇率 7.00；请更新或输入实际付款汇率。';
  if (fxBusy) status = '正在获取最新参考汇率… 当前汇率仍可用于计算。';
  if (fxFailure) status += ' · 更新失败，已保留当前值；可手动修改或重试。';
  $('fx-status').textContent = status;
  $('refresh').disabled = fxBusy;
  $('refresh').textContent = fxBusy ? '更新中…' : state.fxMode === 'manual' ? '恢复自动汇率' : '更新汇率';
}
function syncPrice(active) {
  const fx = number(state.fx), price = number(state.price);
  const cpp = state.priceUnit === 'cpp' ? price : (fx > 0 && price !== null ? price / (10 * fx) : null);
  const cny = state.priceUnit === 'cny' ? price : (fx > 0 && price !== null ? price * 10 * fx : null);
  if (active !== 'cpp') $('cpp').value = state.priceUnit === 'cpp' ? state.price : cpp === null ? '' : editable(cpp);
  if (active !== 'cny-price') $('cny-price').value = state.priceUnit === 'cny' ? state.price : cny === null ? '' : editable(cny);
  $('price-anchor').textContent = state.priceUnit === 'cpp' ? '以美分／点为准' : '以人民币／千点为准';
}
function update() {
  $('sample-tag').hidden = !state.sample;
  $('basis-hint').textContent = state.basis === 'same' ? '与同航班、日期、舱位、人数及行程的含税总价比较。' : '用你实际愿意购买的替代票含税总价，衡量这次兑换的实际节省。';
  $('result-basis').textContent = state.basis === 'same' ? '同航班对比' : '替代机票对比';
  for (const field of ['tax','cash']) {
    const value = number(state[field]), fx = number(state.fx), currency = state[field+'Currency'];
    const converted = currency === 'CNY' ? value / fx : value * fx;
    $(field+'-conversion').textContent = value !== null && fx > 0 && Number.isFinite(converted) ? `约 ${money(converted, currency === 'CNY' ? 'USD' : 'CNY')} ${currency === 'CNY' ? 'USD' : 'CNY'}` : '';
  }
  const r = calculate(state);
  const ids = ['ratio','total-cny','total-usd','cash-cny','cash-usd','savings-cny','savings-usd','savings-rate','redemption-cpp','value-ratio','point-break','tax-break'];
  if (r.error) {
    ids.forEach(id => $(id).textContent = '—');
    $('verdict').textContent = r.error;
    document.querySelector('.times').hidden = false;
    $('mobile-cost').textContent = '请补全有效输入';
    $('mobile-ratio').textContent = '查看结果';
    $('edge-note').textContent = '';
    $('points-bar').style.width = '0%'; $('tax-bar').style.width = '0%';
    $('break-note').textContent = '填完整输入后，显示成本明细。';
    document.querySelector('.result-main').classList.remove('loss');
    return;
  }
  $('ratio').textContent = r.ratio === null ? '不适用' : fmt(r.ratio);
  $('mobile-cost').textContent = `兑换 ${money(r.total*r.fx,'CNY')} / ${money(r.total,'USD')}`;
  $('mobile-ratio').textContent = r.ratio === null ? '倍率不适用' : `${fmt(r.ratio)} 倍 · 查看`;
  document.querySelector('.times').hidden = r.ratio === null;
  const diff = Math.abs(r.savings) < .005 ? 0 : r.savings;
  $('verdict').textContent = diff > 0 ? '按当前输入，里程兑换的实际花费更低。' : diff < 0 ? '按当前输入，现金购票的实际花费更低。' : '按当前输入，两种方式的花费相同。';
  for (const field of ['total','cash','savings']) {
    $(field+'-cny').textContent = money(r[field]*r.fx,'CNY');
    $(field+'-usd').textContent = `${money(r[field],'USD')} USD`;
  }
  $('savings-rate').textContent = r.savingsRate === null ? '不适用' : `${fmt(r.savingsRate*100)}%`;
  $('redemption-cpp').textContent = fmt(r.redemptionCpp,3);
  $('value-ratio').textContent = r.valueRatio === null ? '不适用' : `${fmt(r.valueRatio)} 倍`;
  $('point-break').textContent = dual(r.pointCost,r.fx);
  $('tax-break').textContent = dual(r.tax,r.fx);
  $('points-bar').style.width = `${r.total > 0 ? r.pointCost/r.total*100 : 0}%`;
  $('tax-bar').style.width = `${r.total > 0 ? r.tax/r.total*100 : 0}%`;
  $('break-note').textContent = `${fmt(r.miles,0)} miles × ${fmt(r.cpp,4)} 美分／点 ÷ 100 + ${money(r.tax,'USD')} 税费`;
  const notes = [];
  if (r.total === 0) notes.push('兑换总成本为 0，成本倍率不适用。');
  if (r.cash === 0) notes.push('现金价为 0，节省比例不适用。');
  if (r.cpp === 0) notes.push('买分价格为 0，点数价值倍率不适用。');
  if (r.cash < r.tax) notes.push('税费高于现金票价，兑换 CPP 为负；请核对输入。');
  $('edge-note').textContent = notes.join(' ');
  document.querySelector('.result-main').classList.toggle('loss',diff < 0);
}
function changed() { state.sample = false; save(); update(); }
function renderPresets() {
  $('presets').replaceChildren();
  state.presets.forEach((preset,index) => {
    const group = document.createElement('div'); group.className = 'preset';
    const apply = document.createElement('button'); apply.textContent = `${preset.name || '常用价格'} · ${fmt(number(preset.value),4)} ${preset.unit === 'cpp' ? '美分／点' : '元／千点'}`;
    apply.addEventListener('click',() => {state.price = preset.value;state.priceUnit = preset.unit;syncPrice();changed();$('preset-status').textContent = '已应用常用价格。';});
    const remove = document.createElement('button'); remove.className = 'remove-preset'; remove.textContent = '删除'; remove.setAttribute('aria-label',`删除常用价格 ${preset.name || index+1}`);
    remove.addEventListener('click',() => {state.presets.splice(index,1);renderPresets();save();$('preset-status').textContent = '已删除该常用价格。';});
    group.append(apply,remove);$('presets').append(group);
  });
}
function tripUpdate() {
  const t = state.trip;
  $('return-field').hidden = t.tripType !== 'round';
  $('return-flight-field').hidden = t.tripType !== 'round';
  $('multi-field').hidden = t.tripType !== 'multi';
  const terms = [t.origin,t.destination,t.tripType === 'round' ? '往返' : t.tripType === 'multi' ? '多城市' : '单程',t.depart,t.tripType === 'round' ? t.returnDate : '',t.cabin,`${t.travelers}成人 ${t.children}儿童 ${t.infantsSeat}占座婴儿 ${t.infantsLap}怀抱婴儿`,t.flight,t.tripType === 'round' ? t.returnFlight : '',t.tripType === 'multi' ? t.segments : '','机票 含税总价'];
  $('flight-search').href = `https://www.google.com/search?q=${encodeURIComponent(terms.filter(Boolean).join(' '))}`;
}
function fill() {
  for (const k of ['miles','tax','cash','taxCurrency','cashCurrency','fx']) $(k).value = state[k];
  document.querySelectorAll('[name=basis]').forEach(input => input.checked = input.value === state.basis);
  for (const k of Object.keys(tripDefaults)) $(k).value = state.trip[k];
  syncPrice(); renderPresets(); tripUpdate(); fxStatus(); update();
}
for (const k of ['miles','tax','cash','taxCurrency','cashCurrency']) $(k).addEventListener('input',e => {state[k]=e.target.value;changed();});
for (const [id,unit] of [['cpp','cpp'],['cny-price','cny']]) $(id).addEventListener('input',e => {state.price=e.target.value;state.priceUnit=unit;syncPrice(id);changed();});
$('fx').addEventListener('input',e => {
  fxRequest++; fxBusy=false; fxFailure=false;
  state.fx=e.target.value;state.fxMode='manual';state.manualAt=new Date().toISOString();
  syncPrice();fxStatus();changed();
});
document.querySelectorAll('[name=basis]').forEach(input => input.addEventListener('change',() => {state.basis=input.value;changed();}));
document.querySelectorAll('[data-trip]').forEach(input => input.addEventListener('input',() => {state.trip[input.id]=input.value;tripUpdate();save();$('trip-error').textContent='';}));
$('flight-search').addEventListener('click',e => {
  const t=state.trip;
  let error='';
  if (!t.origin.trim() || !t.destination.trim() || !t.depart) error='请填写出发地、目的地和出发日期。';
  else if (!Number.isInteger(number(t.travelers)) || number(t.travelers)<1 || number(t.travelers)>99) error='人数需要是 1–99 的整数。';
  else if (t.tripType==='round' && (!t.returnDate || t.returnDate<t.depart)) error='请填写不早于出发日期的返程日期。';
  else if (t.tripType==='multi' && !t.segments.trim()) error='请补充其他航段和日期。';
  if(error){e.preventDefault();$('trip-error').textContent=error;}
});
$('save-preset').addEventListener('click',() => {
  if(number(state.price)===null){$('preset-status').textContent='先填入有效的买分价格，再保存。';return;}
  if(state.presets.length>=8){$('preset-status').textContent='最多保存 8 个价格；请先删除不再使用的价格。';return;}
  state.presets.push({name:$('preset-name').value.trim().slice(0,24),value:state.price,unit:state.priceUnit});
  renderPresets();save();$('preset-name').value='';$('preset-status').textContent=storageFailed?'浏览器无法保存；该价格仅在本次页面中可用。':'已保存；点击价格即可复用。';
});
$('demo').addEventListener('click',() => {
  const previous={fx:state.fx,fxMode:state.fxMode,fxDate:state.fxDate,fetchedAt:state.fetchedAt,manualAt:state.manualAt,presets:state.presets};
  state={...initial(),...previous};$('preset-status').textContent='';$('trip-error').textContent='';fill();save();
});
$('reset').addEventListener('click',() => {
  state={...state,miles:'',price:'',tax:'0',cash:'',sample:false,trip:{...tripDefaults}};
  $('trip-error').textContent='';fill();save();$('preset-status').textContent='已清空本次输入，常用价格和汇率已保留。';$('miles').focus();
});
async function refreshRate() {
  const request=++fxRequest;
  fxBusy=true;fxFailure=false;fxStatus();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch('https://api.frankfurter.dev/v2/rate/USD/CNY',{signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    if(data.base!=='USD'||data.quote!=='CNY'||typeof data.rate!=='number'||!Number.isFinite(data.rate)||data.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw new Error('Invalid exchange rate');
    if(request!==fxRequest)return;
    state.fx=String(data.rate);state.fxMode='auto';state.fxDate=data.date;state.fetchedAt=new Date().toISOString();
    $('fx').value=state.fx;syncPrice();save();update();
  } catch { if(request===fxRequest)fxFailure=true; }
  finally {clearTimeout(timer);if(request===fxRequest){fxBusy=false;fxStatus();}}
}
$('refresh').addEventListener('click',refreshRate);
fill();
if(storageFailed)$('storage').textContent='浏览器无法读取已保存输入；当前显示示例，计算仍可使用。';
if(state.fxMode!=='manual' && (state.fxMode==='sample'||!Number.isFinite(Date.parse(state.fetchedAt))||Date.now()-Date.parse(state.fetchedAt)>6*60*60*1000))refreshRate();

$('method-link').addEventListener('click', () => {
  $('calculation-method').open = true;
});
