# DeepSeek Harness Workbench

English | [中文](README.zh.md)

DeepSeek Harness Workbench (`dsh`) is a global, local-first desktop coding agent. It brings projects, conversations, planning, tool execution, and approvals into one workspace, provides English-first core surfaces with Chinese support, and connects to DeepSeek and other compatible model providers.

## Upstream and project relationship

DeepSeek Harness Workbench is an independent derivative of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), the open-source agent harness published by DeepSeek. DeepSeek Harness supplies the core runtime, sessions, tools, and plugin architecture; this project adds an independent desktop product layer, bilingual user experience, multi-provider configuration, task workflow, review surfaces, and local distribution.

DeepSeek Harness Workbench is not an official DeepSeek product and does not represent DeepSeek. The project preserves the upstream MIT license, copyright notices, third-party notices, and a clear record of downstream modifications. It does not claim the DeepSeek Harness implementation as original work.

The current product core includes:

- Project workspaces connected to real local code directories, sessions, and history.
- Coding conversations that use configured model providers to inspect code, edit files, and run commands.
- Plan mode for reviewing an execution plan before mutating work begins.
- Explicit approvals and permissions for risky actions.

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness Workbench is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

### Capability status

| Area | Current status |
| --- | --- |
| Harness coding runtime, sessions, tools, planning, and approvals | Implemented by the upstream DeepSeek Harness foundation |
| Windows Electron shell and bundled local runtime | Implemented and locally packaged |
| English-first core desktop surfaces with Chinese browser-language selection | Implemented locally; remaining package-level copy is being migrated |
| Theme skins and custom image skin | Implemented with related component tests |
| Provider configuration, fusion models, plugin inventory, and vision input routing | Implemented as downstream workbench features |
| Automatic update prompts and GitHub Release delivery | Implemented for Windows NSIS installs |
| Windows code signing and production acceptance | Not completed |

## Run

### Run as a Windows desktop application

The desktop application is the recommended entry point. It bundles the Node Host and Web UI, so installed users do not need to install Node.js or pnpm separately:

```powershell
pnpm.cmd run desktop:dev
```

Build the Windows portable executable and installer with:

```powershell
pnpm.cmd run desktop:dist
```

Artifacts are written to `dist/desktop/artifacts/` as `DeepSeek-Harness-Workbench-*-portable.exe` and the corresponding installer. Installed builds check the independent GitHub Releases channel and let the user decide whether to download and install an update. Current builds are unsigned.

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/bxlh009/deepseek-harness-workbench.git
cd deepseek-harness-workbench
pnpm install
pnpm run build
pnpm dsh web
```

## Support and upstream

- Report DeepSeek Harness Workbench product problems in this project's GitHub repository.
- Report reproducible upstream runtime defects to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) only after confirming they are not caused by downstream changes.
- See the upstream repository for the original DeepSeek Harness documentation and community channels.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
