# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
用户比较一笔机票里程兑换与现金购票的真实成本；使用 Windows、macOS、手机和电脑浏览器。

## Product Purpose
输入即算，以现金票价除以兑换总成本作为主指标，同时提供兑换成本、节省金额、节省比例、兑换 CPP 和点数价值倍率。

## Operating Context
全部输入按所有乘客、完整行程汇总。可以与同航班比较，或与实际愿意购买的替代机票比较。核心离线计算，联网汇率和手动覆盖；本地部署。

## Capabilities and Constraints
静态 HTML/CSS/JavaScript，单文件可分发；Python 可选局域网服务。人民币和美元双币种，税费和票价独立选币种。买分价格可在美分每点、人民币每千点间联动。保存上次输入与常用价格。用户已明确选择首版使用手动票价与航班查询辅助。数据仅在浏览器保存、不跨设备同步。保留旧版单项换算入口。

## Brand Commitments
用户 2026-10-12 指定参考 GOV.UK Design System、UK Parliament Design System 与 teenage engineering 的设计。参考设计原则与视觉语言，不代表任何官方身份。中文产品名称为机票兑换成本计算器。

## Evidence on Hand
当前真实功能和测试位于 index.html、app.js、cost.js、cost.test.mjs、resilience.test.mjs。初始金额明确标注为示例。

## Product Principles
- 总成本优先，公开换算口径。
- 跨币种比较保持一致。
- 联网失败不阻止计算。
- 本地、轻量、可携带。

## SerpApi 接入
用户已选择 SerpApi。自动报价在本地 Python 服务运行，密钥仅从环境变量或启动时隐藏输入读取。浏览器逐程选航班，再核对完整行程的售票选项；保留手动票价和离线单文件。
