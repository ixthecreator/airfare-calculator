const key='airfare-calculator-v1';
let state={mode:'value',currency:'USD',points:'',cpp:'',tax:'0',cash:''};
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&['value','cpp','points'].includes(saved.mode))state={...state,...saved};}catch{}
const definitions={points:['兑换点数','点','如 60,000'],cpp:['目标 CPP','分 / 点','如 1.5'],tax:['兑换税费 / 附加费','','如 50'],cash:['现金票价（含税）','','如 950']};
const modes={value:{fields:['points','cpp','tax'],title:'点数值多少钱？',result:'等效现金票价',formula:'等效票价 = 点数 × CPP ÷ 100 + 兑换税费'},cpp:{fields:['cash','points','tax'],title:'这次兑换值不值？',result:'实际兑换 CPP',formula:'CPP =（现金票价 − 兑换税费）÷ 点数 × 100'},points:{fields:['cash','cpp','tax'],title:'这个票价对应多少点数？',result:'对应点数',formula:'点数 =（现金票价 − 兑换税费）÷ 目标 CPP × 100'}};
const $=id=>document.getElementById(id);
const fmt=(n,max=2)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:max}).format(n);
const money=n=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:state.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{$('storage').textContent='当前浏览器无法保存输入 · 计算仍可使用';}}
function render(){
if(!['USD','CNY','CAD','EUR','GBP','JPY'].includes(state.currency))state.currency='USD';
$('currency').value=state.currency;
document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',b.dataset.mode===state.mode));
const config=modes[state.mode];$('input-title').textContent=config.title;$('result-title').textContent=config.result;$('formula').textContent=config.formula;
$('fields').replaceChildren();
config.fields.forEach(k=>{const [title,unit,placeholder]=definitions[k];const label=document.createElement('label');label.textContent=title;const wrapper=document.createElement('div');wrapper.className='input';const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.placeholder=placeholder;input.value=state[k];input.setAttribute('aria-label',title);input.addEventListener('input',()=>{state[k]=input.value;save();update();});const suffix=document.createElement('span');suffix.className='unit';suffix.textContent=unit||state.currency;wrapper.append(input,suffix);label.append(wrapper);$('fields').append(label);});update();
}
function update(){
const values={};for(const k of ['points','cpp','cash','tax']){const s=String(state[k]).trim().replace(/[,，\s]/g,'');values[k]=s!==''&&/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)?Number(s):null;}
const r=airfareCalculate(state.mode,values);$('summary').className='sub';
if(r.error){$('result').textContent='—';$('summary').textContent=r.error;$('details').textContent='支持 60,000 或 60000 格式。';return;}
$('result').textContent=state.mode==='value'?money(r.result):state.mode==='cpp'?fmt(r.result,3)+' CPP':fmt(Math.ceil(r.result),0)+' 点';
if(r.negative){$('summary').textContent='兑换税费高于现金票价，请检查输入。';$('summary').classList.add('error');}
else $('summary').textContent=state.mode==='value'?'按你设定的点数价值，加上兑换税费。':state.mode==='cpp'?`每点抵扣 ${fmt(r.result,3)} ${state.currency} 分。`:'按目标 CPP 换算，向上取整至整数点。';
$('details').textContent=state.mode==='value'?`点数价值 ${money(values.points*values.cpp/100)} + 税费 ${money(values.tax)}`:`现金票价 ${money(values.cash)} − 税费 ${money(values.tax)} = ${money(values.cash-values.tax)}`;
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;save();render();});$('currency').onchange=e=>{state.currency=e.target.value;save();render();};$('reset').onclick=()=>{state={...state,points:'',cpp:'',cash:'',tax:'0'};save();render();};render();
