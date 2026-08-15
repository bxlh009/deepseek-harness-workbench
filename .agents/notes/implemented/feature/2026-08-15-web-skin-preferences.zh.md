# Agent Note: Web 皮肤偏好

Status: implemented

English | [中文](2026-08-15-web-skin-preferences.md)

## Problem

Web UI 原本只有持久化的浅色／深色／跟随系统偏好；用户无法在不改变整体配色模式的情况下切换产品强调色。皮肤功能必须在刷新和回环地址重连后保留，并且要在外壳绘制前生效，同时与浅色／深色选择保持独立。

## Decision

扩展现有 `ui-theme` 设置命名空间，加入带 schema 默认值的 `skin` 字段。内置四套皮肤：`classic`、`ocean`、`forest` 和 `sunset`；`classic` 保留当前色板。ThemeRuntime 在 `ThemeSnapshot` 中发布选中皮肤并提供 `setSkin`，ThemePresenter 将它投影为 `body[data-ds-skin]`。Host index transform 在插件加载前也写入同一个属性。

全局 `design-platform.css` 负责皮肤对应的语义别名覆盖。外观行新增可访问的皮肤卡片：使用 `aria-pressed`、可见的 `:focus-visible` 焦点环和原生键盘按钮；预览色条只引用现有静态 token。皮肤选择不会改变 `light`／`dark`／`system` 配色偏好。

## Alternatives considered

**独立的 localStorage 偏好。** 否决，因为这会破坏现有 Host 支撑的持久化约定和跨端口回环行为。

**单独的 UI 插件。** 否决，因为现有 `ui-theme` 插件已经拥有设置 schema、首屏引导变换、运行时快照和全局颜色 token。

**把皮肤和浅色／深色绑定。** 否决，因为用户应当可以在浅色、深色和跟随系统之间切换，同时保留当前皮肤。

## Consequences

- 现有设置文档仍然有效，因为 `skin` 默认是 `classic`。
- 第一份 HTML 响应会在客户端插件加载前同时设置配色模式和皮肤。
- 功能 CSS 继续消费语义 `--dsw-*` 别名；皮肤选择器留在主题所有方。
- 四套内置皮肤是固定产品预设；第三方注册 ThemeRuntime 主题仍是独立扩展面。

## Testing

针对 ui-theme/ui-layout 的聚焦测试通过：10 个文件、75 个测试。Web 设置快照和浏览器流程已覆盖皮肤行、持久化、刷新与跨端口状态。
