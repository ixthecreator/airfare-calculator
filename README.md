# 机票兑换成本计算器

比较里程兑换与现金购票的真实成本，支持人民币与美元、买分价格联动、自动参考汇率、常用价格和本地输入保存。核心计算无需联网。

网页版：https://ixthecreator.github.io/airfare-calculator/

## 网页版与本地版

GitHub Pages 网页版支持手动现金票价、航班查询辅助和参考汇率更新。GitHub Pages 不运行 Python 后端，因此网页版不会调用 SerpApi，也不接收或保存 API key。

本地版使用 Python 3：

```sh
python3 server.py --ask-key --open
```

macOS 也可双击 `启动自动票价-mac.command`；Windows 双击 `启动自动票价-windows.bat`。密钥通过隐藏输入提供，仅用于当前服务进程。详细设置见 `SerpApi配置说明.txt`。关闭服务后需重新输入密钥。

## 发布更新

```sh
python3 build_pages.py
node --test cost.test.mjs resilience.test.mjs fares-ui.test.mjs
python3 -m unittest -q test_fares.py
```

提交并推送 `main` 分支后，GitHub Pages 从 `/docs` 自动发布。`docs/` 是生成文件，应先修改项目根目录的源文件，再重新构建。

输入保存在当前浏览器，不跨设备同步。现金报价及兑换税费应填全部乘客、完整行程的总额；售票价格、税费和规则最终以售票方为准。
