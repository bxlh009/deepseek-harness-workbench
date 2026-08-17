import assert from 'node:assert/strict'
import test from 'node:test'
import { updateCopy } from '../src/update-copy.mjs'

test('desktop update prompts default to English for global users', () => {
  const copy = updateCopy('fr-FR')
  assert.equal(copy.availableTitle, 'Update available')
  assert.equal(copy.downloadButton, 'Download and install')
  assert.match(copy.availableDetail, /API keys/)
})

test('desktop update prompts remain available in Chinese', () => {
  const copy = updateCopy('zh-CN')
  assert.equal(copy.availableTitle, '发现新版本')
  assert.equal(copy.downloadButton, '下载并安装')
  assert.match(copy.availableDetail, /API 密钥/)
})
