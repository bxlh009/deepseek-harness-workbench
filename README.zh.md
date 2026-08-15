# 深寻工作台

[English](README.md) | 中文

深寻工作台（`dsh`）是面向中文开发者的本地优先编码代理桌面应用。它把项目、对话、计划、工具执行和审批放进一个工作区，让用户通过类似 Codex 的工作流交给代理完成真实的软件任务。

## 上游来源与项目关系

深寻工作台是基于 DeepSeek 官方开源项目 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 二次开发的独立项目。DeepSeek Harness 提供核心运行时、会话、工具和插件架构；本项目在此基础上增加独立桌面产品层、中文用户体验、模型配置、任务工作流、审查界面和本地分发。

深寻工作台不是 DeepSeek 官方产品，也不代表 DeepSeek 官方立场。本项目保留上游 MIT 许可证、版权声明、第三方声明和清晰的下游修改记录，不会把 DeepSeek Harness 的实现描述为自身原创。

当前版本的产品核心是：

- 项目工作区：连接本地代码目录，保留真实会话与历史。
- 编码对话：通过 DeepSeek 模型分析代码、修改文件、运行命令。
- 计划模式：先审阅执行计划，再进入实际操作。
- 审批与权限：危险操作仍经过明确确认，避免把“能执行”误当成“应该执行”。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

深寻工作台目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

### 能力状态

| 范围 | 当前状态 |
| --- | --- |
| Harness 编码运行时、会话、工具、计划与审批 | 由上游 DeepSeek Harness 基础能力实现 |
| Windows Electron 桌面壳与内置本地运行时 | 已实现并完成本地打包 |
| 中文桌面品牌与核心界面本地化 | 已在本地实现 |
| 主题皮肤与自定义图片皮肤 | 已实现并通过相关组件测试 |
| 拉取请求、Sites、计划任务和完整插件管理器 | 尚未形成产品工作流；占位入口不算能力 |
| 代码签名、自动更新、公开稳定版与生产验收 | 尚未完成 |

## 运行

### 作为 Windows 桌面应用运行

桌面端是推荐入口。它会把 Node Host 和 Web UI 一起封装，安装后的用户不需要另外安装 Node.js 或 pnpm：

```powershell
pnpm.cmd run desktop:dev
```

构建便携版和 Windows 安装包：

```powershell
pnpm.cmd run desktop:dist
```

产物位于 `dist/desktop/artifacts/`，包括 `ShenXun-Workbench-*-portable.exe` 和安装程序。当前构建尚未签名，也没有自动更新渠道。

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/bxlh009/shenxun-workbench.git
cd shenxun-workbench
pnpm install
pnpm run build
pnpm dsh web
```

## 支持与上游

- 深寻工作台发布后，产品问题统一提交到本项目 GitHub 仓库。
- 只有确认不是下游修改引起的、可独立复现的运行时缺陷，才提交给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。
- 原始 DeepSeek Harness 文档和社区渠道以其上游仓库为准。

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
