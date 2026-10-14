---
name: 机票兑换成本计算器
description: Baby blue 渐变、毛玻璃表面与缓慢流动的背景。
colors:
  ink: "#193b57"
  muted: "#3a536a"
  paper: "#f5faff"
  ground: "#d8eafa"
  panel: "#e5f2fd"
  line: "#b2ccdf"
  strong-line: "#6889a2"
  accent: "#a1cef1"
  accent-ink: "#154f79"
  shell: "#d4eafa"
  focus: "#246b9c"
  error: "#a5263d"
  white: "#ffffff"
typography:
  headline:
    fontFamily: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-.025em"
  title:
    fontFamily: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    fontWeight: 400
  hint:
    fontFamily: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "12px"
    lineHeight: 1.65
  label:
    fontFamily: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    fontWeight: 600
  readout:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "68px"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-.035em"
  number-input:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.2
  money:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "23px"
    fontWeight: 500
    letterSpacing: "-.025em"
rounded:
  control: "10px"
  surface: "16px"
  radio: "50%"
spacing:
  control-gap: "8px"
  compact-gap: "12px"
  grid-gap: "16px"
  field-gap: "22px"
  compact-layout-gap: "24px"
  panel-padding: "26px"
  layout-gap: "32px"
  page-gutter: "40px"
components:
  button-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-demo:
    backgroundColor: "rgba(255,255,255,.58)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-search:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0"
  numeric-input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.number-input}"
    rounded: "{rounded.control}"
  input-panel:
    backgroundColor: "rgba(255,255,255,.56)"
    rounded: "{rounded.surface}"
    padding: "26px"
  result-panel:
    backgroundColor: "rgba(222,240,255,.58)"
    rounded: "{rounded.surface}"
    padding: "0 25px 23px"
  sample-tag:
    textColor: "{colors.muted}"
    padding: "4px 7px"
---

# Design System: 机票兑换成本计算器

## Overview

用户最新指定 Baby blue 渐变、毛玻璃及缓慢流动。原有公共服务表单的信息层级保留，旧版灰橙配色和设备式直角表面被替换。

## Colors

页面从 #edf7ff、#c5e3fa 过渡到 #e7f2fc。背景光色使用 #9acbf4、#eefaff、#a9d6f6。主体文字 #193b57、辅助文字 #3a536a、节省金额 #154f79；亏损和错误 #a5263d，保留文字说明。控件边框 #6889a2，键盘焦点 #246b9c 并以白色衬边区分背景。

## Typography

离线原生系统字体和等宽数字特性（tabular-nums）。页面标题 32px、字段标签 14px、提示 12px、辅助单位 11px；主倍率 76px／700、主金额 24px／600。字形和数字本身不参与背景动画。

## Layout

最大容器1184px，桌面两列比例1.13:1，列间距32px。1020px、800px调整间距和字段排列；640px以下为单列，买分价格数字和单位上下排。360px以下进一步缩小边距。手机底部实时摘要固定并预留安全区和正文底部空间。

## Elevation & Depth

表单为56%白色，结果为白色至浅蓝半透明渐变；22px backdrop blur、125%饱和度，16px表面圆角。白色细边模拟玻璃边缘，12px偏移的柔和蓝色阴影区分层次。输入框使用较实的72%白色和清晰边框。底部摘要88%不透明并使用20px模糊。不支持 backdrop-filter 或偏好减少透明度时使用不透明浅蓝底。

## Shapes

面板16px，控件10px；单选圆点保留。成本比例条以较深蓝色和baby blue区分。

## Motion

持续动效由同一节奏的baby blue天空层和柔白云带组成，固定背景层平移和轻微缩放：48s ease-in-out infinite alternate。输入、结果和内容布局保持稳定。仅动画transform，不逐帧改变blur或布局。页面隐藏时暂停；系统减少动态效果时静止；页脚提供“暂停背景流动／继续背景流动”开关。按钮背景反馈120ms。

## Components

语义化label、input、select、radio、button与details保持。结果标题置于同一玻璃表面，比较基准为小型胶囊，所有文字深蓝。比较基准使用分段选择器，选中项白底、深蓝文字和阴影，同时保留原生单选语义。表单数字完整显示，金额允许换行。交互焦点蓝色外框配白色衬边，文本选区浅蓝，输入光标深蓝。

## Do's and Don'ts

- 保留双币种、单位、完整行程口径、示例标记与公式。
- 将模糊用于表面背后的背景，保证文字和控件清晰。
- 让渐变缓慢连续移动，不移动输入区或闪动数字。
- 降级和减少动态偏好下仍完整可用。

## Flighty reference

参考 https://flighty.com/ 官网展示的界面：醒目的无衬线数字、紧凑的辅助数据、圆角分区和明确的分段选择状态。这是针对计算器的设计转译，并非声称使用其未公开的内部规范。保留用户指定的baby blue、玻璃和缓慢流动。

## Cloud atmosphere

天空以 #a5cef1、#c2e1f9、#b4d8f5 为核心。柔白云带分布于左上、右侧与下方，通过重叠渐变与静态12px柔化形成云雾感。动画只改变transform，48秒往返。暂停、页面隐藏和减少动态设置同时控制天空与云层。

## Fare search

展开“查询现金票价”后填写机场、日期、乘客分类和每程航班号。报价在玻璃表单中按分隔行展示；保留原生checkbox、清楚的币种、来源时间和来源链接。选择条件改变立即废弃旧结果。报价经过整程核对后由用户主动应用，应用后在现金输入附近显示本次来源。离线页面说明需要本地服务，缺少密钥时提供配置说明文件名。
