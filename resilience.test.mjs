import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('./cost.js',import.meta.url),'utf8');
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
function setup({fetchImpl,saved,brokenStorage=false}={}) {
  const elements=new Map();
  class Element {
    constructor(){this.value='';this.textContent='';this.style={};this.events={};this.children=[];this.classList={remove(){},toggle(){}};}
    addEventListener(type,fn){this.events[type]=fn;}
    replaceChildren(){this.children=[];}
    append(...items){this.children.push(...items);}
    setAttribute(){}
    focus(){}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const basis=['same','alternative'].map(value=>Object.assign(new Element(),{value}));
  let stored=saved?JSON.stringify(saved):null;
  let fetchCount=0;
  const context=vm.createContext({console,Intl,Date,setTimeout,clearTimeout,AbortController,
    document:{getElementById:get,createElement:()=>new Element(),querySelector:get,querySelectorAll:selector=>selector==='[name=basis]'?basis:[]},
    localStorage:{getItem(){if(brokenStorage)throw Error('denied');return stored;},setItem(k,v){if(brokenStorage)throw Error('denied');stored=v;}},
    fetch:(...args)=>{fetchCount++;return fetchImpl?fetchImpl(...args):Promise.reject(Error('offline'));}
  });
  vm.runInContext(core,context);vm.runInContext(app,context);
  return {get,input:(id,value)=>{get(id).value=value;get(id).events.input({target:get(id)});},get saved(){return JSON.parse(stored);},get fetchCount(){return fetchCount;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('offline rate failure preserves numbers and calculation',async()=>{const ui=setup();await settle();assert.match(ui.get('fx-status').textContent,/更新失败/);assert.equal(ui.get('fx').value,'7');assert.equal(ui.get('ratio').textContent,'1.35');});
test('in-flight automatic refresh cannot overwrite a manual rate',async()=>{let resolve;const ui=setup({fetchImpl:()=>new Promise(r=>resolve=r)});ui.input('fx','7.25');resolve({ok:true,json:async()=>({base:'USD',quote:'CNY',rate:6.8,date:'2026-10-12'})});await settle();assert.equal(ui.get('fx').value,'7.25');assert.equal(ui.saved.fxMode,'manual');assert.equal(ui.get('refresh').disabled,false);});
test('saved manual rate is never automatically refreshed',async()=>{const ui=setup({saved:{fx:'7.1',fxMode:'manual',manualAt:'2026-10-12T10:00:00Z'}});await settle();assert.equal(ui.fetchCount,0);assert.equal(ui.get('fx').value,'7.1');});
test('invalid API payload keeps the last rate',async()=>{const ui=setup({fetchImpl:async()=>({ok:true,json:async()=>({base:'EUR',quote:'CNY',rate:8,date:'2026-10-12'})})});await settle();assert.equal(ui.get('fx').value,'7');assert.match(ui.get('fx-status').textContent,/更新失败/);});
test('storage failure does not break calculations',async()=>{const ui=setup({brokenStorage:true});await settle();ui.input('cash','700');assert.equal(ui.get('ratio').textContent,'0.79');assert.match(ui.get('storage').textContent,/无法保存/);assert.match(ui.get('verdict').textContent,/现金购票/);});
test('valid reference rate is saved with source date',async()=>{const ui=setup({fetchImpl:async()=>({ok:true,json:async()=>({base:'USD',quote:'CNY',rate:6.8,date:'2026-10-12'})})});await settle();assert.equal(ui.get('fx').value,'6.8');assert.equal(ui.saved.fxDate,'2026-10-12');assert.equal(ui.saved.fxMode,'auto');assert.equal(ui.get('cny-price').value,'95.2');});
