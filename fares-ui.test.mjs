import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./fares-ui.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup({protocol='http:',staticHosting=false,provider}={}) {
  class El {
    constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.disabled=false;this.checked=false;this.textContent='';this.hidden=false;}
    addEventListener(k,fn){this.events[k]=fn;}
    append(...items){this.children.push(...items);}
    replaceChildren(){this.children=[];}
    setAttribute(){}
    focus(){this.focused=true;}
    querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}
  }
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id);};
  const state={trip:{origin:'JFK',destination:'PVG',tripType:'oneway',depart:'2099-11-10',returnDate:'',cabin:'商务舱',flight:'MU588',returnFlight:'',segments:'',travelers:'1',children:'0',infantsSeat:'0',infantsLap:'0'},basis:'same',cashCurrency:'USD',cash:'1200'};
  const calls=[];let updates=0;
  const context={location:{protocol},document:{createElement:t=>new El(t),querySelectorAll:()=>[get('origin'),get('cashCurrency')]},$:get,state,fetch:async(path,options)=>{calls.push({path,options});if(path.endsWith('status'))return {ok:true,json:async()=>({configured:true,token:'csrf'})};return provider(path,options);},AbortController,AbortSignal,URL,JSON,Date,Error,setTimeout,clearTimeout,dateTime:x=>x,money:(v,c)=>`${c} ${v}`,changed:()=>updates++};
  context.document.documentElement={dataset:{hosting:staticHosting?'static':''}};
  vm.runInNewContext(source,context);
  return {get,state,calls,get updates(){return updates;},click:id=>get(id).events.click(),input:id=>get(id).events.input()};
}
const data={kind:'quotes',currency:'USD',passengers:{adults:1,children:0,infants_in_seat:0,infants_on_lap:0},selected:[],options:[{seller:'Test airline',price:875,baggage:[],marketed:[]}],source:'Local mock',sourceUrl:'https://www.google.com/travel/flights',fetchedAt:'2026-10-12T20:00:00Z',sourceAt:'2026-10-12 20:00:00 UTC'};
test('offline standalone never calls local API',async()=>{const ui=setup({protocol:'file:'});await settle();assert.equal(ui.calls.length,0);assert.equal(ui.get('fare-query').disabled,true);assert.match(ui.get('fare-status').textContent,/离线单文件/);});
test('GitHub Pages never queries a missing backend even after edits',async()=>{const ui=setup({protocol:'https:',staticHosting:true});await settle();ui.input('origin');await ui.click('fare-query');assert.equal(ui.calls.length,0);assert.equal(ui.get('fare-query').disabled,true);assert.match(ui.get('fare-status').textContent,/GitHub Pages/);assert.equal(ui.state.cash,'1200');});
test('quote needs confirmation and preserves raw group price without multiplying',async()=>{const ui=setup({provider:async()=>({ok:true,json:async()=>data})});await settle();await ui.click('fare-query');const root=ui.get('fare-results'),apply=root.querySelectorAll('button')[0],check=root.querySelectorAll('input')[0];apply.events.click();assert.equal(ui.state.cash,'1200');assert.equal(check.focused,true);check.checked=true;apply.events.click();assert.equal(ui.state.cash,'875');assert.equal(ui.updates,1);});
test('changing conditions during query rejects late response',async()=>{let finish;const ui=setup({provider:()=>new Promise(r=>finish=r)});await settle();const pending=ui.click('fare-query');await settle();ui.state.trip.origin='LAX';ui.input('origin');finish({ok:true,json:async()=>data});await pending;assert.equal(ui.state.cash,'1200');assert.equal(ui.get('fare-results').children.length,0);assert.match(ui.get('fare-status').textContent,/条件已改变/);});
test('manual cash input invalidates previously rendered quote',async()=>{const ui=setup({provider:async()=>({ok:true,json:async()=>data})});await settle();await ui.click('fare-query');const root=ui.get('fare-results'),apply=root.querySelectorAll('button')[0];root.querySelectorAll('input')[0].checked=true;ui.state.cash='999';ui.input('cash');apply.events.click();assert.equal(ui.state.cash,'999');});
test('API failure retains cash and shows recovery message',async()=>{const ui=setup({provider:async()=>({ok:false,json:async()=>({error:'额度不足'})})});await settle();await ui.click('fare-query');assert.equal(ui.state.cash,'1200');assert.match(ui.get('fare-status').textContent,/额度不足/);assert.equal(ui.get('fare-query').disabled,false);});
