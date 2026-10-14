"""Prepare the public, credential-free GitHub Pages site in docs/."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
destination = root / 'docs'
destination.mkdir(exist_ok=True)
assets = ('styles.css', 'cost.js', 'app.js', 'fares-ui.js', 'legacy.html', 'legacy-app.js', 'calculator.js')
for name in assets:
    shutil.copyfile(root / name, destination / name)
html = (root / 'index.html').read_text()
html = html.replace('<html lang="zh-CN">', '<html lang="zh-CN" data-hosting="static">', 1)
html = html.replace('SerpApi 自动查询 · 支持手动搜索', '网页版 · 手动航班搜索')
(destination / 'index.html').write_text(html)
(destination / '.nojekyll').write_text('')
print('GitHub Pages ready: docs/ (8 public assets, no backend or credentials)')
