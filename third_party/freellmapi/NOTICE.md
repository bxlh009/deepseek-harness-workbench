# FreeLLMAPI embedded runtime

This directory contains a generated runtime built from
[`tashfeenahmed/freellmapi`](https://github.com/tashfeenahmed/freellmapi) at
commit `f2d0070ddd81d8b6233d9227550bea3195513db2` (desktop version `0.8.0`).

The upstream project is distributed under the MIT License. The unmodified
license text is included as `LICENSE`. `server.mjs` is produced by the
upstream `desktop/scripts/bundle-server.mjs`; `client-dist` is produced by the
upstream client build. DeepSeek Harness starts this runtime only on loopback
and stores its database below the Electron user-data directory.
