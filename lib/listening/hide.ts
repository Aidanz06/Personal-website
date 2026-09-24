/**
 * The hide list, read out of content/listening.json.
 *
 * Pure — the reading is lib/listening/file.ts, because a `node:fs` import
 * anywhere in a client component's graph fails the build.
 */

import type { HideRule, ListeningFile } from './types.ts'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The rules, with blank ones dropped.
 *
 * The file ships with an empty slot so the shape is visible, and an empty
 * rule must hide nothing — never everything.
 */
export function resolveHideList(file: ListeningFile | undefined): HideRule[] {
  return (file?.hide ?? []).filter(
    (rule) => text(rule?.artist) !== '' || text(rule?.track) !== '',
  )
}
