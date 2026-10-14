/* Live fares are optional. The standalone calculator remains fully offline-capable. */
(() => {
  'use strict';
  const button = $('fare-query'), status = $('fare-status'), results = $('fare-results');
  let token = '', revision = 0, controller = null, busy = false;
  const staticHosting = document.documentElement?.dataset.hosting === 'static';
  const local = !staticHosting && ['http:', 'https:'].includes(location.protocol);
  const stamp = value => value ? dateTime(value) : '来源未提供';
  function node(tag, value, cls) {
    const el = document.createElement(tag);
    if (value !== undefined) el.textContent = value;
    if (cls) el.className = cls;
    return el;
  }
  function snapshot() {
    const t = state.trip;
    return {origin:t.origin,destination:t.destination,tripType:t.tripType,depart:t.depart,returnDate:t.returnDate,cabin:t.cabin,flight:t.flight,returnFlight:t.returnFlight,segments:t.segments,adults:t.travelers,children:t.children,infants_in_seat:t.infantsSeat,infants_on_lap:t.infantsLap,basis:state.basis,currency:state.cashCurrency};
  }
  function invalidate(message = '条件已改变，请重新查询。') {
    revision++; controller?.abort(); controller = null; busy = false;
    button.disabled = !local; button.textContent = '查询匹配票价';
    results.replaceChildren(); $('cash-source').hidden = true;
    if (local) status.textContent = message;
  }
  function setBusy(value) {
    busy = value; button.disabled = value || !local;
    button.textContent = value ? '查询中…' : '查询匹配票价';
    results.setAttribute('aria-busy', String(value));
    results.querySelectorAll('button').forEach(b => b.disabled = value);
  }
  async function connect() {
    if (!local) {
      status.textContent = staticHosting
        ? '当前为 GitHub Pages 网页版，支持手动票价、航班搜索与汇率更新。SerpApi 自动查价请使用本地版；密钥不会保存在网页中。'
        : '当前为离线单文件。自动票价需通过本地服务打开；请按 SerpApi配置说明.txt 启动，手动计算仍可使用。';
      button.disabled = true;return false;
    }
    try {
      const response = await fetch('/api/fares/status', {cache:'no-store', signal:AbortSignal.timeout(5000)});
      if (!response.ok) throw Error();
      const data = await response.json();
      token = data.token || '';
      status.textContent = data.configured ? 'SerpApi 已就绪。点击查询才发送行程条件；逐程选择可能消耗多次请求。' : '本地服务已连接，但尚未配置 SerpApi key。请按配置说明设置并重启；输入会保留。';
      return Boolean(data.configured && token);
    } catch {
      status.textContent = '无法连接报价服务。请运行最新版 server.py 后重试，或继续手动输入。';
      return false;
    }
  }
  function sourceInfo(data) {
    const p = node('p',`${data.source} · 本地获取 ${stamp(data.fetchedAt)} · 来源处理 ${data.sourceAt || '未提供'}${data.localCache ? ' · 本地缓存' : ''}。来源也可能使用最长 1 小时缓存。`,'hint');
    const link = node('a','在 Google Flights 核对完整行程');
    try {
      const url = new URL(data.sourceUrl);
      if (url.protocol !== 'https:' || !['google.com','www.google.com'].includes(url.hostname) || !url.pathname.startsWith('/travel/flights')) throw Error();
      link.href = url.href;
    } catch { link.href = 'https://www.google.com/travel/flights'; }
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    results.append(p,link);
  }
  function itinerary(legs) {
    return legs.flatMap((leg,i) => leg.map(s => `第 ${i+1} 程 · ${s.number} · ${s.origin} → ${s.destination}\n${s.depart} → ${s.arrive}（机场当地时间） · ${s.cabin}`)).join('\n');
  }
  function render(data, expected, requestRevision) {
    results.replaceChildren();
    const pax = data.passengers;
    const people = `${pax.adults} 成人 / ${pax.children} 儿童 / ${pax.infants_in_seat} 占座婴儿 / ${pax.infants_on_lap} 怀抱婴儿`;
    if (data.kind === 'flights') {
      status.textContent = `选择第 ${data.stage}/${data.stages} 程 · ${people}`;
      if (data.selected.length) results.append(node('p',itinerary(data.selected),'fare-itinerary hint'));
      if (!data.options.length) {
        results.append(node('p','没有找到条件完整匹配且可继续核价的航班。可检查航班号、日期和舱位，或使用手动票价。','hint'));
      }
      data.options.forEach(option => {
        const row = node('div',undefined,'fare-option');
        row.append(node('p',itinerary([option.segments]).replace('第 1 程',`第 ${data.stage} 程`),'fare-itinerary'));
        row.append(node('p',option.price === null ? '此阶段未提供参考价' : `搜索参考价 ${money(option.price,data.currency)} · 完整行程报价待核对`,'hint'));
        const select = node('button',option.final ? '选择并核对整程报价' : '选择此程，继续下一程','quiet');
        select.addEventListener('click',() => request('/api/fares/choose',{choice:option.id},expected));
        row.append(select);results.append(row);
      });
    } else {
      status.textContent = `完整行程售票选项 · ${people} · ${data.currency}`;
      results.append(node('p',itinerary(data.selected),'fare-itinerary hint'));
      if (!data.options.length) results.append(node('p','未返回可用的整程合并出票报价（分开出票及附加电话服务费选项不导入）。请在来源页面核对后手动填写。','hint'));
      data.options.forEach(option => {
        const row = node('div',undefined,'fare-option');
        row.append(node('strong',`${option.seller} · ${money(option.price,data.currency)}`));
        if (option.marketed.length) row.append(node('p',`售票航班号：${option.marketed.join(' / ')}`,'hint'));
        row.append(node('p',option.baggage.length ? option.baggage.join('；') : '来源未提供行李与退改详情，请在售票页面核对。','hint'));
        const label = node('label',undefined,'fare-confirm');
        const check = document.createElement('input');check.type = 'checkbox';
        label.append(check,node('span',`我已核对这是全部乘客、完整行程的含税总价（${people}），接受该票价条件。`));
        const apply = node('button','使用此报价','quiet');
        apply.addEventListener('click',() => {
          if (busy || requestRevision !== revision || JSON.stringify(snapshot()) !== expected) {invalidate();return;}
          if (!check.checked) {status.textContent = '请先在来源页面核对整程、人数及含税总价，再勾选确认。';check.focus();return;}
          state.cash=String(option.price);state.cashCurrency=data.currency;
          $('cash').value=state.cash;$('cashCurrency').value=data.currency;changed();
          $('cash-source').hidden=false;
          $('cash-source').textContent=`已使用 ${option.seller} 报价 · ${stamp(data.fetchedAt)} · ${data.currency} · 已确认全部乘客与完整行程。最终支付价以售票方为准。`;
          status.textContent='已填入现金票价，计算结果已更新。';
        });
        row.append(label,apply);results.append(row);
      });
    }
    sourceInfo(data);
  }
  async function request(path, payload, expected) {
    const requestRevision = ++revision;
    controller?.abort();controller = new AbortController();
    const current = controller;
    const timer = setTimeout(() => current.abort(),40000);
    setBusy(true);status.textContent='正在查询… 当前现金价保持不变。';
    try {
      const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Airfare-Token':token},body:JSON.stringify(payload),signal:current.signal});
      const data=await response.json();
      if (requestRevision !== revision || JSON.stringify(snapshot()) !== expected) return;
      if (!response.ok) throw Error(data.error || '查询失败，请稍后重试。');
      render(data,expected,requestRevision);
    } catch(error) {
      if (requestRevision===revision) status.textContent=error.name==='AbortError' ? '查询超时；现金价已保留，可重试或手动输入。' : `查询未完成：${error.message} 当前现金价已保留。`;
    } finally {
      clearTimeout(timer);if(requestRevision===revision)setBusy(false);
    }
  }
  button.addEventListener('click',async () => {
    if(busy)return;
    const version=revision;button.disabled=true;
    const ready=await connect();button.disabled=!local;
    if(!ready || version!==revision)return;
    results.replaceChildren();const data=snapshot();
    await request('/api/fares/search',data,JSON.stringify(data));
  });
  document.querySelectorAll('[data-trip], [name=basis], #cashCurrency').forEach(el=>el.addEventListener('input',()=>invalidate()));
  $('cash').addEventListener('input',()=>invalidate('现金价已手动修改；再次使用自动报价前请重新查询。'));
  ['demo','reset'].forEach(id=>$(id).addEventListener('click',()=>invalidate('输入已重置；可以重新查询票价。')));
  connect();
})();
