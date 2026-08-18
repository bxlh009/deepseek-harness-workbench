/**
 * Build a self-contained Windows runtime for the Electron desktop package.
 *
 * The workspace intentionally uses peer dependencies between its published
 * packages, so copying pnpm's workspace links is not a valid distribution
 * artifact. This script packs the DSH and vendored families, installs every
 * packed package into a clean runtime, and copies the current Node executable
 * beside that runtime for Electron's HostSupervisor to own.
 */

import { spawnSync } from 'node:child_process'
import { createPackageWithOptions } from '@electron/asar'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_ROOT = join(REPOSITORY_ROOT, 'dist', 'desktop', 'package')
const TARBALL_ROOT = join(OUTPUT_ROOT, 'tarballs')
const RUNTIME_ROOT = join(OUTPUT_ROOT, 'runtime')
const RUNTIME_ARCHIVE = join(OUTPUT_ROOT, 'runtime.asar')
const NPM_CACHE_ROOT = join(OUTPUT_ROOT, 'npm-cache')
const FREELLMAPI_SOURCE = join(REPOSITORY_ROOT, 'third_party', 'freellmapi')
const FREELLMAPI_RUNTIME = join(OUTPUT_ROOT, 'freellmapi')
const VERSION = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')).version

function commandSpec(command) {
  if (process.platform !== 'win32') return { command, prefix: [] }
  if (command === 'node') return { command: process.execPath, prefix: [] }

  const nodeDirectory = dirname(process.execPath)
  const candidates = command === 'pnpm'
    ? [
      join(nodeDirectory, 'node_modules', 'corepack', 'dist', 'pnpm.js'),
      join(nodeDirectory, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
    ]
    : [join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  const script = candidates.find((candidate) => existsSync(candidate))
  if (script === undefined) {
    throw new Error(`Could not resolve the Windows ${command} JavaScript entry beside ${process.execPath}.`)
  }
  return { command: process.execPath, prefix: [script] }
}

function run(command, args, cwd = REPOSITORY_ROOT, environment = {}) {
  const resolved = commandSpec(command)
  const result = spawnSync(resolved.command, [...resolved.prefix, ...args], {
    cwd,
    env: { ...process.env, ...environment },
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}`)
}

function readManifest(directory) {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
}

function workspaceDirectories() {
  const directories = []
  const packageRoot = join(REPOSITORY_ROOT, 'packages')
  for (const family of readdirSync(packageRoot, { withFileTypes: true })) {
    if (!family.isDirectory()) continue
    const familyRoot = join(packageRoot, family.name)
    for (const member of readdirSync(familyRoot, { withFileTypes: true })) {
      if (member.isDirectory() && existsSync(join(familyRoot, member.name, 'package.json'))) {
        directories.push(join(familyRoot, member.name))
      }
    }
  }
  for (const application of readdirSync(join(REPOSITORY_ROOT, 'apps'), { withFileTypes: true })) {
    if (application.isDirectory() && application.name !== 'desktop'
      && existsSync(join(REPOSITORY_ROOT, 'apps', application.name, 'package.json'))) {
      directories.push(join(REPOSITORY_ROOT, 'apps', application.name))
    }
  }
  for (const vendor of readdirSync(join(REPOSITORY_ROOT, 'vendor'), { withFileTypes: true })) {
    if (vendor.isDirectory() && existsSync(join(REPOSITORY_ROOT, 'vendor', vendor.name, 'package.json'))) {
      directories.push(join(REPOSITORY_ROOT, 'vendor', vendor.name))
    }
  }
  return directories.sort()
}

function tarballName(manifest) {
  const unscoped = manifest.name.startsWith('@')
    ? manifest.name.slice(1).replace('/', '-')
    : manifest.name
  return `${unscoped}-${manifest.version}.tgz`
}

function packWorkspace(directory, destination) {
  const manifest = readManifest(directory)
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') return undefined
  const expected = join(destination, tarballName(manifest))
  run('pnpm', [
    '--dir', directory,
    'pack',
    '--pack-destination', destination,
    '--config.ignore-scripts=true',
  ])
  if (!existsSync(expected)) throw new Error(`Expected pack output was not created: ${expected}`)
  return { name: manifest.name, tarball: expected }
}

function buildRuntime(packages) {
  mkdirSync(RUNTIME_ROOT, { recursive: true })
  mkdirSync(NPM_CACHE_ROOT, { recursive: true })
  const dependencies = Object.fromEntries(packages.map(({ name, tarball }) => [name, pathToFileURL(tarball).href]))
  writeFileSync(join(RUNTIME_ROOT, 'package.json'), `${JSON.stringify({
    name: '@deepseek-ai/dsh-desktop-runtime',
    version: VERSION,
    private: true,
    type: 'module',
    dependencies,
  }, null, 2)}\n`)
  run('npm', [
    'install',
    '--include=optional',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ], RUNTIME_ROOT, {
    npm_config_cache: process.env.DSH_DESKTOP_NPM_CACHE ?? NPM_CACHE_ROOT,
  })
  rmSync(NPM_CACHE_ROOT, { recursive: true, force: true })

  if (process.platform !== 'win32') throw new Error('Windows desktop packaging requires a Windows Node runtime.')
  const nodeSource = process.env.DSH_DESKTOP_NODE_RUNTIME ?? process.execPath
  const nodeTarget = join(RUNTIME_ROOT, 'node.exe')
  if (!existsSync(nodeSource)) throw new Error(`Bundled Node runtime was not found at ${nodeSource}.`)
  copyFileSync(nodeSource, nodeTarget)
  writeFileSync(join(RUNTIME_ROOT, 'runtime-manifest.json'), `${JSON.stringify({
    version: VERSION,
    node: process.version,
    packageCount: packages.length,
  }, null, 2)}\n`)
}

function buildFreeLlmApiRuntime() {
  if (!existsSync(join(FREELLMAPI_SOURCE, 'server.mjs'))
    || !existsSync(join(FREELLMAPI_SOURCE, 'client-dist', 'index.html'))
    || !existsSync(join(FREELLMAPI_SOURCE, 'LICENSE'))) {
    throw new Error('The pinned FreeLLMAPI runtime or its MIT license is missing.')
  }
  cpSync(FREELLMAPI_SOURCE, FREELLMAPI_RUNTIME, { recursive: true })
  writeFileSync(join(FREELLMAPI_RUNTIME, 'package.json'), `${JSON.stringify({
    name: '@deepseek-harness/freellmapi-sidecar-runtime',
    version: '0.8.0',
    private: true,
    type: 'module',
    dependencies: { 'better-sqlite3': '12.10.0' },
  }, null, 2)}\n`)
  run('npm', [
    'install',
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ], FREELLMAPI_RUNTIME, {
    npm_config_cache: process.env.DSH_DESKTOP_NPM_CACHE ?? NPM_CACHE_ROOT,
  })
}

async function archiveRuntime() {
  await createPackageWithOptions(RUNTIME_ROOT, RUNTIME_ARCHIVE, {
    dot: true,
    // @electron/asar matches this pattern against absolute Windows paths with
    // matchBase enabled. A slash-containing glob misses nested native modules.
    unpack: '*.{node,exe,dll}',
  })
}

async function main() {
  rmSync(OUTPUT_ROOT, { recursive: true, force: true })
  mkdirSync(TARBALL_ROOT, { recursive: true })

  const packages = []
  for (const directory of workspaceDirectories()) {
    const packed = packWorkspace(directory, TARBALL_ROOT)
    if (packed !== undefined) packages.push(packed)
  }
  const uniquePackages = [...new Map(packages.map((entry) => [entry.name, entry])).values()]
  if (!uniquePackages.some(({ name }) => name === '@deepseek-ai/dsh')) {
    throw new Error('The packed runtime does not contain @deepseek-ai/dsh.')
  }
  buildRuntime(uniquePackages)
  buildFreeLlmApiRuntime()
  await archiveRuntime()
  console.log(`desktop runtime: ${String(uniquePackages.length)} package tarball(s) installed in ${RUNTIME_ROOT}`)
}

await main()
