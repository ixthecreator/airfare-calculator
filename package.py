"""Build a standalone HTML and a portable ZIP without third-party dependencies."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (root / 'styles.css').read_text() + '</style>')
for script in ['cost.js', 'app.js', 'fares-ui.js']:
    html = html.replace(f'<script src="{script}"></script>', '<script>' + (root / script).read_text() + '</script>')
html = html.replace('<a href="legacy.html">单项换算</a>', '')
(root / '机票兑换成本计算器.html').write_text(html)
files = ['index.html', 'styles.css', 'cost.js', 'app.js', 'calculator.js', 'legacy-app.js', 'legacy.html',
         'server.py', 'fares.py', 'fares-ui.js', 'test_fares.py', 'fares-ui.test.mjs', 'SerpApi配置说明.txt', '启动自动票价-mac.command', '启动自动票价-windows.bat', 'start-mac.command', 'start-windows.bat', '使用说明.txt', '机票兑换成本计算器.html',
         'cost.test.mjs', 'resilience.test.mjs', 'package.py', 'PRODUCT.md', 'DESIGN.md', '.impeccable/design.json', '票价API选型与接入方案.txt']
with zipfile.ZipFile(root / '机票兑换成本计算器.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, 'airfare-calculator/' + name)
print('已生成单文件 HTML 与跨平台 ZIP。')
