import { describe, expect, it } from 'vitest'
import { BUCKET, BUCKET_MOUTH_Y, BUCKET_RIM_FRONT_Y, BUCKET_VIEWBOX } from './bucket'
import { FIRST_STONE_VH, HOME_STONES } from './stones'

describe('the bucket of koi food', () => {
  it('floats between the name and the first stone, on the right', () => {
    expect(BUCKET.depthVh).toBeGreaterThan(0.4)
    expect(BUCKET.depthVh).toBeLessThan(FIRST_STONE_VH - 0.2)
    expect(BUCKET.xFraction).toBeGreaterThan(0.6)
    // Across the pond from the first stone, so the two never crowd.
    expect(Math.abs(BUCKET.xFraction - HOME_STONES[0]!.xFraction)).toBeGreaterThan(0.3)
  })

  it('hides the hand below the front of the rim, not above the mouth', () => {
    expect(BUCKET_RIM_FRONT_Y).toBeGreaterThan(BUCKET_MOUTH_Y)
    expect(BUCKET_RIM_FRONT_Y).toBeLessThan(BUCKET_VIEWBOX)
  })
})
