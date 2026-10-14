(function(root){
function calculate(mode, v){
const required={value:['points','cpp','tax'],cpp:['cash','points','tax'],points:['cash','cpp','tax']}[mode];
if(!required) return {error:'未知计算模式'};
if(required.some(k=>v[k]===null||!Number.isFinite(v[k])))return {error:'填写所有金额与点数，即时得到结果。'};
if(required.some(k=>v[k]<0))return {error:'金额、点数与 CPP 不能为负数。'};
if(mode==='cpp'&&v.points===0)return {error:'兑换点数必须大于 0。'};
if(mode==='points'&&v.cpp===0)return {error:'目标 CPP 必须大于 0。'};
let result=mode==='value'?v.points*v.cpp/100+v.tax:mode==='cpp'?(v.cash-v.tax)/v.points*100:(v.cash-v.tax)/v.cpp*100;
if(!Number.isFinite(result))return {error:'数值过大，请缩小输入。'};
return {result,negative:result<0};
}root.airfareCalculate=calculate;
if(typeof module!=='undefined')module.exports=calculate;
})(typeof globalThis!=='undefined'?globalThis:this);
