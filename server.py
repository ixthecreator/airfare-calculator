"""Serve only the calculator's public files; Python 3 standard library only."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
from urllib.parse import unquote, urlsplit
import argparse
import socket
import webbrowser
import ipaddress
import json
import secrets
from fares import FareError, FareService

PUBLIC = {'index.html', 'styles.css', 'cost.js', 'app.js', 'legacy.html', 'legacy-app.js', 'calculator.js', 'fares-ui.js'}

class Handler(SimpleHTTPRequestHandler):
    def json_response(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def trusted_host(self):
        try:
            address = urlsplit('http://' + self.headers.get('Host', ''))
            if address.port != self.server.server_port:
                return False
            if address.hostname == 'localhost':
                return True
            ip = ipaddress.ip_address(address.hostname)
            return ip.is_loopback or ip.is_private
        except (ValueError, TypeError):
            return False

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith('/api/'):
            if not self.trusted_host():
                return self.json_response(403, {'error':'请通过本机或局域网地址访问。'})
            if path == '/api/fares/status':
                return self.json_response(200, {'configured':bool(self.server.fares.client.key), 'token':self.server.api_token})
            return self.json_response(404, {'error':'接口不存在。'})
        return super().do_GET()

    def do_POST(self):
        origin = self.headers.get('Origin')
        expected = 'http://' + self.headers.get('Host','')
        if (not self.trusted_host() or origin != expected or
                self.headers.get('X-Airfare-Token') != self.server.api_token):
            return self.json_response(403, {'error':'请求校验失败，请刷新本地服务页面重试。'})
        if self.headers.get('Content-Type','').split(';')[0] != 'application/json':
            return self.json_response(415, {'error':'需要 JSON 格式。'})
        try:
            length = int(self.headers.get('Content-Length','0'))
            if length <= 0 or length > 32000:
                return self.json_response(413, {'error':'查询内容过长或为空。'})
            payload = json.loads(self.rfile.read(length))
            if urlsplit(self.path).path == '/api/fares/search':
                result = self.server.fares.search(payload)
            elif urlsplit(self.path).path == '/api/fares/choose':
                if not isinstance(payload,dict):
                    raise FareError('请求格式无效。')
                result = self.server.fares.choose(payload.get('choice'))
            else:
                return self.json_response(404, {'error':'接口不存在。'})
            return self.json_response(200, result)
        except FareError as exc:
            return self.json_response(exc.status, {'error':str(exc)})
        except (ValueError, UnicodeDecodeError):
            return self.json_response(400, {'error':'查询数据无法读取。'})
        except Exception:
            # Never send provider URLs, API keys or raw upstream errors to browsers/logs.
            return self.json_response(502, {'error':'报价服务暂时不可用，当前输入已保留。'})

    def log_message(self, format, *args):
        # Avoid logging query parameters or third-party credentials.
        if not urlsplit(self.path).path.startswith('/api/'):
            super().log_message(format, *args)

    def send_head(self):
        name = unquote(urlsplit(self.path).path)
        if name == '/':
            self.path = '/index.html'
        elif name.lstrip('/') not in PUBLIC or name.count('/') != 1:
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store' if self.path.startswith('/api/') else 'no-cache')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='机票兑换成本计算器本地服务')
    parser.add_argument('--ask-key', action='store_true', help='启动时以隐藏输入方式提供 SerpApi key，仅在本次运行有效')
    parser.add_argument('--lan', action='store_true', help='允许同一局域网内的手机或电脑访问')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true', help='启动后打开浏览器')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    try:
        server = ThreadingHTTPServer(('0.0.0.0' if args.lan else '127.0.0.1', args.port), partial(Handler, directory=str(root)))
    except OSError as exc:
        raise SystemExit(f'启动失败：{exc}。可使用 --port 8766 更换端口。')
    server.fares = FareService()
    if args.ask_key:
        from getpass import getpass
        server.fares.client.key = getpass('SerpApi API key（输入不显示，仅本次有效）：').strip()
    server.api_token = secrets.token_urlsafe(32)
    print('SerpApi：' + ('已配置' if server.fares.client.key else '未配置（手动计算仍可用）'), flush=True)
    url = f'http://localhost:{args.port}'
    print(f'电脑打开：{url}', flush=True)
    if args.lan:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect(('192.0.2.1', 80))
                print(f'同一 Wi-Fi 的手机打开：http://{sock.getsockname()[0]}:{args.port}', flush=True)
        except OSError:
            print(f'手机打开：http://<电脑的局域网 IP>:{args.port}', flush=True)
    print('停止服务：Ctrl+C', flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
