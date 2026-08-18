import { describe, it, expect } from 'vitest'
import {
  toApiImages,
  resolveImageAssets,
  seedImagesFromLineItem,
  type FormImage,
} from './images'
import type { ImageUploadResponse } from '@/lib/api/types'

const img = (over: Partial<FormImage> = {}): FormImage => ({
  key: Math.random().toString(36).slice(2),
  is_primary: false,
  ...over,
})

describe('toApiImages', () => {
  it('drops images without asset_id and keeps only asset_id/is_primary', () => {
    const out = toApiImages([
      img({ asset_id: 'A', is_primary: true }),
      img({ file: new File([], 'x.png') }), // 未上传 → 丢弃
      img({ asset_id: 'B' }),
    ])
    expect(out).toEqual([
      { asset_id: 'A', is_primary: true },
      { asset_id: 'B', is_primary: false },
    ])
  })

  it('forces exactly one primary (first) when none is marked', () => {
    const out = toApiImages([img({ asset_id: 'A' }), img({ asset_id: 'B' })])
    expect(out).toEqual([
      { asset_id: 'A', is_primary: true },
      { asset_id: 'B', is_primary: false },
    ])
  })

  it('returns undefined when there are no uploaded images', () => {
    expect(toApiImages([])).toBeUndefined()
    expect(toApiImages([img({ file: new File([], 'x.png') })])).toBeUndefined()
  })
})

describe('resolveImageAssets', () => {
  it('uploads only pending files and back-fills asset_id/status in order', async () => {
    const uploaded: File[][] = []
    const fakeClient = {
      async uploadImages(files: File[]): Promise<ImageUploadResponse> {
        uploaded.push(files)
        return { images: files.map((_, i) => ({ asset_id: `NEW-${i}`, status: 'APPROVED' })) }
      },
    }
    const input = [
      img({ asset_id: 'EXISTING', is_primary: true }),
      img({ file: new File([], 'a.png') }),
      img({ file: new File([], 'b.png') }),
    ]
    const out = await resolveImageAssets(fakeClient, input)

    expect(uploaded).toHaveLength(1)
    expect(uploaded[0]).toHaveLength(2) // 只上传两张未上传的
    expect(out[0].asset_id).toBe('EXISTING') // 已有的原样保留
    expect(out[1].asset_id).toBe('NEW-0')
    expect(out[2].asset_id).toBe('NEW-1')
    expect(out[1].status).toBe('APPROVED')
  })

  it('maps 207 results back by input_index and skips failed items', async () => {
    const fakeClient = {
      async uploadImages(): Promise<ImageUploadResponse> {
        // 顺序打乱 + 一张失败：用 input_index 映射，失败项(无 asset_id)跳过
        return {
          images: [
            { name: 'FILE_TOO_LARGE', message: 'too big', input_index: 1 },
            { asset_id: 'OK-0', status: 'IN_REVIEW', input_index: 0 },
          ],
        }
      },
    }
    const input = [img({ file: new File([], 'a.png') }), img({ file: new File([], 'b.png') })]
    const out = await resolveImageAssets(fakeClient, input)

    expect(out[0].asset_id).toBe('OK-0') // input_index 0 → 第一张
    expect(out[0].status).toBe('IN_REVIEW')
    expect(out[1].asset_id).toBeUndefined() // 失败的那张不回填
    expect(out[1].file).toBeDefined()
  })

  it('does not call uploadImages when nothing is pending', async () => {
    let called = false
    const fakeClient = {
      async uploadImages(): Promise<ImageUploadResponse> {
        called = true
        return { images: [] }
      },
    }
    const out = await resolveImageAssets(fakeClient, [img({ asset_id: 'A', is_primary: true })])
    expect(called).toBe(false)
    expect(out[0].asset_id).toBe('A')
  })
})

describe('seedImagesFromLineItem', () => {
  it('maps existing line item images to FormImage (asset_id + is_primary)', () => {
    const out = seedImagesFromLineItem({
      name: 'Tote',
      unit_amount: { currency_code: 'USD', value: '10' },
      images: [
        { asset_id: 'A', is_primary: true },
        { asset_id: 'B' },
      ],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ asset_id: 'A', is_primary: true })
    expect(out[1]).toMatchObject({ asset_id: 'B', is_primary: false })
    expect(out[0].file).toBeUndefined()
  })

  it('returns an empty array when there are no images', () => {
    expect(seedImagesFromLineItem(null)).toEqual([])
    expect(seedImagesFromLineItem({ name: 'x', unit_amount: { currency_code: 'USD', value: '1' } })).toEqual([])
  })
})
