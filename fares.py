"""SerpApi flight search adapter. No third-party packages or credential persistence."""
import copy
import json
import math
import os
import re
import secrets
import ssl
import threading
import time
from datetime import date, datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

CABINS = {'经济舱': ('1', 'Economy'), '超级经济舱': ('2', 'Premium Economy'), '商务舱': ('3', 'Business'), '头等舱': ('4', 'First')}

class FareError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def text(value, maximum=200):
    return value[:maximum] if isinstance(value, str) else ''

def flights(value):
    if not isinstance(value, str):
        raise FareError('航班号格式不正确。')
    if not value.strip():
        return []
    codes = [re.sub(r'\s+', '', v).upper() for v in value.replace('，', ',').split(',')]
    if len(codes) > 4 or any(not re.fullmatch(r'[A-Z0-9]{2}\d{1,4}', v) for v in codes):
        raise FareError('航班号请填写 MU588；转机航段用逗号分隔，例如 NH110,UA123。')
    return codes

def airport(value):
    value = text(value).strip().upper()
    if not re.fullmatch(r'[A-Z]{3}', value):
        raise FareError('自动查询需要三字母机场代码，例如 JFK、PVG，不能只填城市名。')
    return value

def day(value):
    try:
        if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError()
        parsed = date.fromisoformat(value)
        if parsed < date.today():
            raise ValueError()
        return value
    except (ValueError, TypeError):
        raise FareError('请填写今天或未来的有效起飞日期。') from None

def count(value, minimum, maximum, label):
    if isinstance(value, bool) or not re.fullmatch(r'\d{1,2}', str(value)):
        raise FareError(f'{label}需要是 {minimum}–{maximum} 的整数。')
    value = int(value)
    if not minimum <= value <= maximum:
        raise FareError(f'{label}需要是 {minimum}–{maximum} 的整数。')
    return value

def normalize(payload):
    if not isinstance(payload, dict):
        raise FareError('查询内容格式不正确。')
    kind = payload.get('tripType')
    if kind not in ('oneway', 'round', 'multi') or payload.get('basis') not in ('same', 'alternative'):
        raise FareError('请选择行程类型和比较基准。')
    cabin = payload.get('cabin')
    if cabin not in CABINS or payload.get('currency') not in ('USD', 'CNY'):
        raise FareError('请选择有效舱位和币种。')
    passengers = {k: count(payload.get(k, '0'), 1 if k == 'adults' else 0, 9, label) for k, label in [('adults','成人数'),('children','儿童数'),('infants_in_seat','占座婴儿数'),('infants_on_lap','怀抱婴儿数')]}
    if sum(passengers.values()) > 9 or passengers['infants_on_lap'] > passengers['adults']:
        raise FareError('每次最多查询 9 位乘客，怀抱婴儿数不能超过成人数。')
    legs = [dict(origin=airport(payload.get('origin')), destination=airport(payload.get('destination')), date=day(payload.get('depart')), flights=flights(payload.get('flight', '')))]
    if kind == 'round':
        legs.append(dict(origin=legs[0]['destination'], destination=legs[0]['origin'], date=day(payload.get('returnDate')), flights=flights(payload.get('returnFlight',''))))
    if kind == 'multi':
        lines = text(payload.get('segments'), 1500).strip().splitlines()
        if not 1 <= len(lines) <= 5:
            raise FareError('多城市请另填 1–5 程，每行：出发机场 到达机场 日期 航班号（可选）。')
        for line in lines:
            parts = line.strip().split(maxsplit=3)
            if len(parts) < 3:
                raise FareError('其他行程格式：PVG HND 2026-12-10 JL086。')
            legs.append(dict(origin=airport(parts[0]), destination=airport(parts[1]), date=day(parts[2]), flights=flights(parts[3] if len(parts)>3 else '')))
    if any(leg['origin'] == leg['destination'] for leg in legs) or any(b['date'] < a['date'] for a,b in zip(legs,legs[1:])):
        raise FareError('每程的出发和到达机场不能相同；日期应按行程先后排列。')
    if payload['basis'] == 'same' and any(not leg['flights'] for leg in legs):
        raise FareError('同航班比较需要每程的航班号；也可切换为“愿意买的替代机票”。')
    return dict(kind=kind, basis=payload['basis'], legs=legs, cabin=cabin, currency=payload['currency'], passengers=passengers)

def parameters(query):
    first = query['legs'][0]
    result = dict(engine='google_flights', hl='en', gl='us', currency=query['currency'], travel_class=CABINS[query['cabin']][0], **query['passengers'])
    result['type'] = {'oneway':'2','round':'1','multi':'3'}[query['kind']]
    if query['kind'] == 'multi':
        result['multi_city_json'] = json.dumps([dict(departure_id=l['origin'],arrival_id=l['destination'],date=l['date']) for l in query['legs']], separators=(',',':'))
    else:
        result.update(departure_id=first['origin'], arrival_id=first['destination'], outbound_date=first['date'])
        if query['kind'] == 'round':
            result['return_date'] = query['legs'][1]['date']
    return result

def amount(value):
    if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or not 0 < value < 1e9:
        return None
    return value

def summarize(item):
    result = []
    if not isinstance(item, dict) or not isinstance(item.get('flights'), list):
        return result
    for f in item['flights'][:8]:
        if not isinstance(f, dict):
            return []
        departure = f.get('departure_airport') or {}
        arrival = f.get('arrival_airport') or {}
        if not isinstance(departure,dict) or not isinstance(arrival,dict):
            return []
        result.append(dict(number=text(f.get('flight_number'),20),airline=text(f.get('airline'),100),cabin=text(f.get('travel_class'),40),origin=text(departure.get('id'),3),destination=text(arrival.get('id'),3),depart=text(departure.get('time'),30),arrive=text(arrival.get('time'),30)))
    return result

def matches(segments, leg, cabin):
    if not segments or segments[0]['origin'] != leg['origin'] or segments[-1]['destination'] != leg['destination'] or segments[0]['depart'][:10] != leg['date']:
        return False
    accepted_cabins = {'first', 'first class'} if cabin == '头等舱' else {CABINS[cabin][1].lower()}
    if any(s['cabin'].strip().lower().replace('_',' ') not in accepted_cabins for s in segments):
        return False
    if any(a['destination'] != b['origin'] for a,b in zip(segments,segments[1:])):
        return False
    return not leg['flights'] or [re.sub(r'\s+','',s['number']).upper() for s in segments] == leg['flights']

def google_link(data):
    meta = data.get('search_metadata') or {}
    url = text(meta.get('google_flights_url'),6000) if isinstance(meta,dict) else ''
    parsed = urlsplit(url)
    return url if parsed.scheme == 'https' and parsed.hostname in ('www.google.com','google.com') and parsed.path.startswith('/travel/flights') else 'https://www.google.com/travel/flights'

class SerpClient:
    def __init__(self, key=None, opener=None, clock=time.time, limit=50):
        self.key = os.environ.get('SERPAPI_API_KEY','').strip() if key is None else key
        self.opener = opener or self.secure_open
        self.clock = clock
        self.limit = limit
        self.calls = []
        self.cache = {}
        self.lock = threading.Lock()

    @staticmethod
    def secure_open(request, timeout):
        context = ssl.create_default_context()
        # Some python.org macOS installs have no default CA bundle. Supplement
        # system trust when certifi is available; never disable TLS verification.
        try:
            import certifi
        except ImportError:
            pass
        else:
            context.load_verify_locations(cafile=certifi.where())
        return urlopen(request, timeout=timeout, context=context)

    def fetch(self, params):
        if not self.key:
            raise FareError('尚未配置 SerpApi key。请按“SerpApi配置说明.txt”设置并重启本地服务。',503)
        cache_key = json.dumps(params,sort_keys=True)
        with self.lock:
            now = self.clock()
            self.cache = {k:v for k,v in self.cache.items() if now-v[0] < 300}
            if cache_key in self.cache:
                data = copy.deepcopy(self.cache[cache_key][1]);data['_local_cache']=True
                return data
            self.calls = [t for t in self.calls if now-t<3600]
            if len(self.calls)>=self.limit:
                raise FareError('已达到本地每小时 50 次请求上限，请稍后再试或手动输入。',429)
            if self.calls and now-self.calls[-1]<2:
                raise FareError('请求过于频繁，请等待两秒再试。',429)
            self.calls.append(now)
        request = Request('https://serpapi.com/search?'+urlencode(dict(params,api_key=self.key)),headers={'Accept':'application/json','User-Agent':'LocalAirfareCalculator/1.0'})
        try:
            with self.opener(request,timeout=35) as response:
                raw=response.read(4_000_001)
            if len(raw)>4_000_000:
                raise FareError('报价响应过大，请缩小查询条件。',502)
            data=json.loads(raw)
        except HTTPError as exc:
            message={401:'SerpApi key 无效，请检查本地配置。',403:'SerpApi 拒绝访问，请检查账号权限。',429:'SerpApi 额度或速率受限，请稍后重试。'}.get(exc.code,'SerpApi 暂时无法返回报价，请稍后重试。')
            raise FareError(message,502) from None
        except (URLError,TimeoutError,OSError,ValueError):
            raise FareError('联网查询失败或超时；当前现金价已保留，可手动输入。',502) from None
        if not isinstance(data,dict) or data.get('error'):
            raise FareError('SerpApi 未能返回有效结果；请检查条件、额度及账号状态。',502)
        meta=data.get('search_metadata') or {}
        if not isinstance(meta,dict) or meta.get('status') != 'Success':
            raise FareError('报价尚未完成，请稍后重试。',502)
        data['_fetched_at']=datetime.now(timezone.utc).isoformat()
        data['_local_cache']=False
        with self.lock:
            self.cache[cache_key]=(self.clock(),copy.deepcopy(data))
        return data

class FareService:
    def __init__(self, client=None, clock=time.time):
        self.client=client or SerpClient()
        self.clock=clock
        self.choices={}
        self.lock=threading.Lock()

    def store(self, value):
        with self.lock:
            now=self.clock()
            self.choices={k:v for k,v in self.choices.items() if now-v[0]<900}
            if len(self.choices)>=1000:
                oldest=min(self.choices,key=lambda k:self.choices[k][0]);del self.choices[oldest]
            key=secrets.token_urlsafe(24)
            self.choices[key]=(now,copy.deepcopy(value))
            return key

    def search(self,payload):
        query=normalize(payload)
        params=parameters(query)
        # SerpApi can directly price fully specified non-connecting one-way/return flights.
        if query['basis']=='same' and query['kind']!='multi' and all(len(l['flights'])==1 for l in query['legs']):
            pinned={}
            for name,leg in zip(('outbound','return'),query['legs']):
                pinned[name]=[dict(flight_number=leg['flights'][0],departure_id=leg['origin'],arrival_id=leg['destination'],date=leg['date'])]
            params['selected_flights_json']=json.dumps(pinned,separators=(',',':'))
            data=self.client.fetch(params)
            actual=[summarize(v) for v in data.get('selected_flights',[]) if isinstance(v,dict)] if isinstance(data.get('selected_flights'),list) else []
            if len(actual)!=len(query['legs']) or any(not matches(a,l,query['cabin']) for a,l in zip(actual,query['legs'])):
                raise FareError('没有返回完全匹配的完整航班报价；请核对航班号、日期、机场和舱位，或使用手动搜索。',422)
            return self.quotes(query,actual,data)
        params['show_hidden']='true'
        return self.options(query,params,[],self.client.fetch(params))

    def choose(self,choice):
        with self.lock:
            entry=self.choices.get(choice) if isinstance(choice,str) else None
        if not entry or self.clock()-entry[0]>=900:
            raise FareError('候选报价已过期，请重新查询。',410)
        value=copy.deepcopy(entry[1])
        data=self.client.fetch(value['params'])
        if value['final']:
            return self.quotes(value['query'],value['selected'],data)
        return self.options(value['query'],value['params'],value['selected'],data)

    def envelope(self,query,data):
        meta=data.get('search_metadata') or {}
        echoed=data.get('search_parameters') or {}
        if isinstance(echoed,dict) and echoed.get('currency',query['currency']) != query['currency']:
            raise FareError('来源返回的币种与请求不同，请重新查询。',502)
        return dict(currency=query['currency'],passengers=query['passengers'],fetchedAt=data.get('_fetched_at',''),sourceAt=text(meta.get('processed_at'),60),localCache=bool(data.get('_local_cache')),sourceUrl=google_link(data),source='SerpApi / Google Flights')

    def options(self,query,params,selected,data):
        stage=len(selected)
        if stage>=len(query['legs']):
            raise FareError('行程选择状态无效，请重新查询。')
        out=self.envelope(query,data)
        out.update(kind='flights',stage=stage+1,stages=len(query['legs']),selected=selected,options=[])
        candidates=[]
        for key in ('best_flights','other_flights'):
            if isinstance(data.get(key),list): candidates+=data[key]
        for item in candidates:
            segments=summarize(item)
            if not matches(segments,query['legs'][stage],query['cabin']):continue
            last=stage==len(query['legs'])-1
            token=item.get('booking_token' if last else 'departure_token')
            if not isinstance(token,str) or not token or len(token)>16000:continue
            next_params=parameters(query)
            next_params['booking_token' if last else 'departure_token']=token
            chosen=selected+[segments]
            choice=self.store(dict(query=query,params=next_params,selected=chosen,final=last))
            out['options'].append(dict(id=choice,segments=segments,price=amount(item.get('price')),final=last))
            if len(out['options'])>=20:break
        return out

    def quotes(self,query,selected,data):
        out=self.envelope(query,data)
        out.update(kind='quotes',selected=selected,options=[])
        # Booking response must restate the full itinerary. Never import a partial-leg fare.
        actual=[summarize(v) for v in data.get('selected_flights',[]) if isinstance(v,dict)] if isinstance(data.get('selected_flights'),list) else []
        if len(actual)!=len(selected):
            raise FareError('来源未返回完整行程，无法确认报价范围；请在 Google Flights 核对后手动填写。',422)
        for i,(returned,previous) in enumerate(zip(actual,selected)):
            exact=dict(query['legs'][i],flights=[re.sub(r'\s+','',s['number']).upper() for s in previous])
            if not matches(returned,exact,query['cabin']):
                raise FareError('最终报价的航班或舱位发生变化，请重新查询或手动核对。',422)
        bookings=data.get('booking_options')
        for option in bookings if isinstance(bookings,list) else []:
            if not isinstance(option,dict) or option.get('separate_tickets'):continue
            together=option.get('together')
            if not isinstance(together,dict):continue
            price=amount(together.get('price'))
            if price is None:continue
            fee=together.get('estimated_phone_service_fee')
            if fee is not None and amount(fee) is not None:continue
            details=[text(v,200) for v in together.get('baggage_prices',[]) if isinstance(v,str)] if isinstance(together.get('baggage_prices'),list) else []
            marketed=[text(v,30) for v in together.get('marketed_as',[]) if isinstance(v,str)] if isinstance(together.get('marketed_as'),list) else []
            out['options'].append(dict(seller=text(together.get('book_with'),100) or '售票方未注明',price=price,baggage=details,marketed=marketed))
        out['options']=sorted(out['options'],key=lambda v:v['price'])[:20]
        return out
