import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const DESKTOP_ROOT = fileURLToPath(new URL('..', import.meta.url))

test('desktop package uses the DeepSeek Harness Workbench brand and icon', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(packageJson.description, 'Global, local-first, multi-provider coding agent desktop workbench built on DeepSeek Harness')
  assert.equal(packageJson.version, '0.1.0-rc.11')
  assert.equal(packageJson.build.productName, 'DeepSeek Harness Workbench')
  assert.equal(packageJson.build.nsis.shortcutName, 'DeepSeek Harness Workbench')
  assert.equal(packageJson.build.win.icon, 'build/deepseek-icon.png')
  assert.match(packageJson.build.win.artifactName, /^DeepSeek-Harness-Workbench-/)

  const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8')
  assert.match(main, /const PRODUCT_NAME = 'DeepSeek Harness Workbench'/)

  const icon = await stat(join(DESKTOP_ROOT, 'build', 'deepseek-icon.png'))
  assert.ok(icon.size > 1_000, 'desktop icon should be a real rendered image')
})

test('desktop package exposes an in-app updater backed by the independent release repository', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.dependencies['electron-updater'], '^6.8.9')
  assert.deepEqual(packageJson.build.publish, [{
    provider: 'github',
    owner: 'bxlh009',
    repo: 'deepseek-harness-workbench',
  }])

  const preload = await readFile(new URL('../src/preload.cjs', import.meta.url), 'utf8')
  assert.doesNotMatch(preload, /^import\s/m)
  assert.match(preload, /require\(['"]electron['"]\)/)
  assert.match(preload, /checkForUpdates/)
  assert.match(preload, /dsh:updates:check/)

  const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8')
  assert.match(main, /preload\.cjs/)
  assert.match(main, /registerDesktopUpdater/)

  const updater = await readFile(new URL('../src/updater.mjs', import.meta.url), 'utf8')
  assert.match(updater, /autoDownload = false/)
  assert.match(updater, /downloadUpdate\(\)/)
  assert.match(updater, /setTimeout/)
  assert.match(updater, /setInterval/)
  assert.match(updater, /updateCopy\(app\.getLocale\(\)\)/)
})

test('desktop releases publish updater metadata and installer artifacts from version tags', async () => {
  const workflow = await readFile(new URL('../../../.github/workflows/desktop-release.yml', import.meta.url), 'utf8')

  assert.match(workflow, /tags:/)
  assert.match(workflow, /desktop-v\*/)
  assert.match(workflow, /desktop:package/)
  assert.match(workflow, /electron-builder\.CMD --win nsis --publish never/)
  assert.match(workflow, /gh release create/)
  assert.match(workflow, /--latest/)
  assert.doesNotMatch(workflow, /--publish always/)
  assert.match(workflow, /GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
})

test('desktop installer ships the runtime as one archive plus native unpacked files', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.notEqual(packageJson.build.nsis.useZip, true)
  assert.deepEqual(packageJson.build.extraResources, [{
    from: '../../dist/desktop/package/runtime.asar',
    to: 'runtime.asar',
  }, {
    from: '../../dist/desktop/package/runtime.asar.unpacked/node.exe',
    to: 'runtime.asar.unpacked/node.exe',
  }, {
    from: '../../dist/desktop/package/runtime.asar.unpacked/node_modules',
    to: 'runtime.asar.unpacked/node_modules',
    filter: ['**/*'],
  }, {
    from: '../../dist/desktop/package/freellmapi',
    to: 'freellmapi',
    filter: ['**/*'],
  }])
})
