import copy
import io
import json
import threading
import unittest
from functools import partial
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from fares import FareError, FareService, SerpClient, normalize, parameters, matches, summarize
from server import Handler

BASE=dict(origin='JFK',destination='PVG',depart='2099-11-10',returnDate='2099-11-20',tripType='oneway',cabin='商务舱',flight='MU588',returnFlight='MU587',segments='',basis='same',currency='USD',adults='1',children='0',infants_in_seat='0',infants_on_lap='0')

def flight(origin='JFK',destination='PVG',day='2099-11-10',number='MU 588',cabin='Business',**extra):
    return dict(flights=[dict(flight_number=number,travel_class=cabin,airline='Fixture airline',departure_airport={'id':origin,'time':day+' 12:00'},arrival_airport={'id':destination,'time':day+' 23:00'})],price=900,booking_token='booking',departure_token='depart',**extra)

def response(**extra):
    return dict(search_metadata={'status':'Success','processed_at':'2026-10-12 20:00:00 UTC','google_flights_url':'https://www.google.com/travel/flights'},_fetched_at='2026-10-12T20:00:00+00:00',**extra)

class FakeClient:
    key='fixture-no-real-key'
    def __init__(self,*responses): self.responses=list(responses);self.params=[]
    def fetch(self,params):
        self.params.append(copy.deepcopy(params));return copy.deepcopy(self.responses.pop(0))

class SearchTests(unittest.TestCase):
    def test_validation(self):
        for patch in [dict(origin='纽约'),dict(depart='2020-01-01'),dict(flight=''),dict(adults='0'),dict(children='9'),dict(infants_on_lap='2'),dict(cabin='Suite'),dict(currency='EUR'),dict(tripType='round',returnDate='2099-11-09')]:
            with self.subTest(patch=patch),self.assertRaises(FareError):normalize(dict(BASE,**patch))
    def test_pinned_exact_single_and_round_trip(self):
        for kind in ('oneway','round'):
            selected=[flight()]
            if kind=='round':selected.append(flight(origin='PVG',destination='JFK',day='2099-11-20',number='MU587'))
            client=FakeClient(response(selected_flights=selected,booking_options=[{'together':{'price':875}}]))
            out=FareService(client).search(dict(BASE,tripType=kind))
            self.assertEqual(out['kind'],'quotes');self.assertEqual(out['options'][0]['price'],875)
            pinned=json.loads(client.params[0]['selected_flights_json'])
            self.assertEqual(pinned['outbound'][0]['flight_number'],'MU588')
            self.assertEqual('return' in pinned,kind=='round')
    def test_pinned_mismatch_never_becomes_quote(self):
        client=FakeClient(response(selected_flights=[flight(number='MU590')],booking_options=[{'together':{'price':100}}]))
        with self.assertRaises(FareError):FareService(client).search(BASE)
    def test_live_provider_first_class_label(self):
        payload=dict(BASE,destination='HND',flight='JL5',cabin='头等舱')
        for cabin in ('First Class','First'):
            item=flight(destination='HND',number='JL 5',cabin=cabin)
            data=response(selected_flights=[item],booking_options=[{'together':{'book_with':'JAL','price':21936}}])
            result=FareService(FakeClient(data)).search(payload)
            self.assertEqual(result['options'][0]['price'],21936)
        for cabin in ('Business','Economy',''):
            item=flight(destination='HND',number='JL 5',cabin=cabin)
            data=response(selected_flights=[item],booking_options=[{'together':{'price':100}}])
            with self.assertRaises(FareError):FareService(FakeClient(data)).search(payload)
    def test_wrong_currency_rejected(self):
        data=response(selected_flights=[flight()],booking_options=[{'together':{'price':100}}],search_parameters={'currency':'CNY'})
        with self.assertRaises(FareError):FareService(FakeClient(data)).search(BASE)
    def test_passengers_and_codes(self):
        q=normalize(dict(BASE,origin=' jfk ',flight='mu 588',adults='2',children='1'))
        self.assertEqual(q['legs'][0]['flights'],['MU588'])
        p=parameters(q);self.assertEqual(p['adults'],2);self.assertEqual(p['children'],1);self.assertEqual(p['travel_class'],'3')
    def test_round_params(self):
        p=parameters(normalize(dict(BASE,tripType='round')))
        self.assertEqual(p['type'],'1');self.assertEqual(p['return_date'],'2099-11-20')
    def test_multi_params_and_required_flights(self):
        q=normalize(dict(BASE,tripType='multi',segments='PVG HND 2099-11-12 JL086\nHND JFK 2099-11-15 JL006'))
        p=parameters(q);self.assertEqual(p['type'],'3');self.assertEqual(len(json.loads(p['multi_city_json'])),3)
        with self.assertRaises(FareError):normalize(dict(BASE,tripType='multi',segments='PVG HND 2099-11-12'))
    def test_matching_rejects_wrong_flight_date_airport_and_mixed_cabin(self):
        q=normalize(BASE)
        for item in [flight(number='MU590'),flight(day='2099-11-11'),flight(destination='SHA'),flight(cabin='Economy')]:
            self.assertFalse(matches(summarize(item),q['legs'][0],q['cabin']))
    def test_oneway_search_and_final_quote(self):
        client=FakeClient(response(best_flights=[flight(),flight(number='MU590')]),response(selected_flights=[flight()],booking_options=[{'together':{'book_with':'Example airline','price':875,'marketed_as':['MU588']}}]))
        service=FareService(client)
        out=service.search(dict(BASE,basis='alternative'));self.assertEqual(len(out['options']),1);self.assertEqual(out['kind'],'flights')
        quote=service.choose(out['options'][0]['id']);self.assertEqual(quote['kind'],'quotes');self.assertEqual(quote['options'][0]['price'],875)
        self.assertEqual(client.params[-1]['booking_token'],'booking');self.assertNotIn('departure_token',client.params[-1])
    def test_round_does_not_import_outbound_search_price(self):
        back=flight(origin='PVG',destination='JFK',day='2099-11-20',number='MU587')
        client=FakeClient(response(best_flights=[flight()]),response(best_flights=[back]),response(selected_flights=[flight(),back],booking_options=[{'together':{'price':1500}}]))
        service=FareService(client)
        first=service.search(dict(BASE,tripType='round',basis='alternative'));self.assertFalse(first['options'][0]['final'])
        second=service.choose(first['options'][0]['id']);self.assertEqual(second['stage'],2);self.assertEqual(client.params[-1]['departure_token'],'depart')
        quote=service.choose(second['options'][0]['id']);self.assertEqual(quote['options'][0]['price'],1500)
    def test_multi_selects_all_legs_before_quote(self):
        next_leg=flight(origin='PVG',destination='HND',day='2099-11-12',number='JL086')
        client=FakeClient(response(best_flights=[flight()]),response(best_flights=[next_leg]),response(selected_flights=[flight(),next_leg],booking_options=[{'together':{'price':1800}}]))
        service=FareService(client)
        one=service.search(dict(BASE,tripType='multi',segments='PVG HND 2099-11-12 JL086'))
        two=service.choose(one['options'][0]['id']);quote=service.choose(two['options'][0]['id'])
        self.assertEqual(quote['options'][0]['price'],1800);self.assertEqual(client.params[-1]['type'],'3')
    def test_partial_or_changed_booking_itinerary_rejected(self):
        for selected in [[],[flight(number='MU590')],[flight(cabin='Economy')]]:
            service=FareService(FakeClient())
            with self.assertRaises(FareError):service.quotes(normalize(BASE),[summarize(flight())],response(selected_flights=selected,booking_options=[{'together':{'price':900}}]))
    def test_bad_price_and_separate_tickets_and_phone_fees_skipped(self):
        opts=[{'together':{'price':v}} for v in [None,False,0,-1,float('nan'),float('inf'),'900']]
        opts += [{'separate_tickets':True,'together':{'price':100}},{'together':{'price':150,'estimated_phone_service_fee':20}},{'together':{'price':900}}]
        out=FareService(FakeClient()).quotes(normalize(BASE),[summarize(flight())],response(selected_flights=[flight()],booking_options=opts))
        self.assertEqual([o['price'] for o in out['options']],[900])
    def test_expired_choice(self):
        now=[0];service=FareService(FakeClient(response(best_flights=[flight()])),clock=lambda:now[0]);out=service.search(dict(BASE,basis='alternative'));now[0]=901
        with self.assertRaises(FareError):service.choose(out['options'][0]['id'])
    def test_cache_and_limit(self):
        now=[0];opener=Mock(side_effect=lambda *a,**k:io.BytesIO(json.dumps(response()).encode()))
        client=SerpClient(key='not-real',opener=opener,clock=lambda:now[0],limit=2)
        self.assertFalse(client.fetch({'x':1})['_local_cache']);self.assertTrue(client.fetch({'x':1})['_local_cache']);self.assertEqual(opener.call_count,1)
        with self.assertRaises(FareError):client.fetch({'x':2})
        now[0]=3;client.fetch({'x':2});now[0]=6
        with self.assertRaises(FareError):client.fetch({'x':3})
    def test_missing_key_and_provider_errors_never_leak_key(self):
        with self.assertRaises(FareError):SerpClient(key='').fetch({})
        for failure in [URLError('secret'),HTTPError('https://example/?api_key=secret',401,'secret',{},None),TimeoutError('secret')]:
            client=SerpClient(key='secret',opener=Mock(side_effect=failure))
            with self.assertRaises(FareError) as result:client.fetch({})
            self.assertNotIn('secret',str(result.exception))
    def test_provider_error_json_is_sanitized(self):
        client=SerpClient(key='secret',opener=lambda *a,**k:io.BytesIO(b'{"error":"secret"}'))
        with self.assertRaises(FareError) as result:client.fetch({})
        self.assertNotIn('secret',str(result.exception))

class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(Path(__file__).parent)))
        cls.server.fares=FareService(SerpClient(key=''));cls.server.api_token='test-csrf'
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def call(self,path,body=None,headers=None,method=None):
        c=HTTPConnection('127.0.0.1',self.server.server_port)
        c.request(method or ('POST' if body is not None else 'GET'),path,body=body,headers=headers or {})
        r=c.getresponse();status=r.status;raw=r.read();c.close();return status,raw
    def headers(self):
        return {'Origin':f'http://127.0.0.1:{self.server.server_port}','Content-Type':'application/json','X-Airfare-Token':'test-csrf'}
    def test_status_only_exposes_configuration_boolean(self):
        status,raw=self.call('/api/fares/status');self.assertEqual(status,200);self.assertFalse(json.loads(raw)['configured']);self.assertNotIn('api_key',raw.decode())
    def test_cross_origin_and_missing_token_rejected(self):
        for patch in [{'Origin':'https://evil.example'},{'X-Airfare-Token':''},{'Host':f'evil.example:{self.server.server_port}'}]:
            self.assertEqual(self.call('/api/fares/search',json.dumps(BASE),dict(self.headers(),**patch))[0],403)
    def test_missing_key_returns_useful_error(self):
        status,raw=self.call('/api/fares/search',json.dumps(BASE),self.headers());self.assertEqual(status,503);self.assertIn('尚未配置',raw.decode())
    def test_private_files_not_served(self):
        self.assertEqual(self.call('/fares.py')[0],404)
        self.assertEqual(self.call(quote('/SerpApi配置说明.txt'))[0],404)
    def test_reject_invalid_json_and_content_type(self):
        self.assertEqual(self.call('/api/fares/search','bad json',self.headers())[0],400)
        self.assertEqual(self.call('/api/fares/search','{}',dict(self.headers(),**{'Content-Type':'text/plain'}))[0],415)

if __name__=='__main__':unittest.main()
