import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildListingPayload, todayUtc } from './listing.mjs'

test('todayUtc 返回 UTC 的 YYYY-MM-DD', () => {
  assert.equal(todayUtc(new Date('2026-08-13T23:30:00Z')), '2026-08-13')
})

test('buildListingPayload 过滤目录并附带元数据', () => {
  const entries = [
    { type: '-', name: '2026-08-11.csv', size: 10, modifyTime: 111 },
    { type: 'd', name: 'subdir', size: 0, modifyTime: 222 },
  ]
  const payload = buildListingPayload(entries, 'hkpsp', '2026-08-13')
  assert.equal(payload.generatedAt, '2026-08-13')
  assert.equal(payload.credentialId, 'hkpsp')
  assert.deepEqual(payload.files, [{ name: '2026-08-11.csv', size: 10, modifyTime: 111 }])
})
