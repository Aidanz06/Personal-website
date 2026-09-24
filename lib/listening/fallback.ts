/**
 * /listening with JavaScript off.
 *
 * The rocks are real buttons over a canvas, so with no script they are
 * focusable controls scattered over an empty pond that will never draw — a
 * worse page than a plain list, not a better one. So the whole rock layer is
 * hidden and a list takes its place: the same tracks and albums, in the same order, with
 * the same words.
 *
 * Built as a string and set directly, the same way the slideshow's fallback
 * is, and for the same reason: a browser WITH JavaScript parses whatever is
 * inside <noscript> as plain text rather than as elements, so React hydration
 * finds text where it expects a tree. Setting the markup sidesteps it.
 *
 * The stylesheet lives inside the <noscript> too, so the rule only exists in
 * the situation where it is true — the choice is made by the browser before
 * first paint, not by a script that has to run first.
 */

import type { Boulder, Pebble } from './types.ts'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function titleLine(title: string, artist: string, rank?: number): string {
  const number =
    rank === undefined ? '' : `<span class="lf-n">${String(rank).padStart(2, '0')}</span>`
  return (
    `${number}<span class="lf-t">${escapeHtml(title)}</span>` +
    `<span class="lf-a">${escapeHtml(artist)}</span>`
  )
}

export type FallbackContent = {
  pebbles: readonly Pebble[]
  boulders: readonly Boulder[]
  neverLeaveLabel: string
}

export function listeningFallbackMarkup(content: FallbackContent): string {
  const style =
    '<style>' +
    // The rocks and the pond are both useless without a script.
    '.listening-rocks{display:none!important}' +
    '.listening-pond{min-height:0!important}' +
    '.lf{list-style:none;padding:0;margin:16px 0}' +
    '.lf li{margin:0 0 12px}' +
    '.lf-n,.lf-a{display:block;font-family:var(--font-mono);font-size:var(--text-small);color:var(--color-muted)}' +
    '.lf-t{display:block}' +
    '.lf-l{display:block;font-family:var(--font-mono);font-size:var(--text-small)}' +
    '.lf-h{font-family:var(--font-mono);font-size:var(--text-small);color:var(--color-muted);margin-top:32px}' +
    '</style>'

  const pebbles = content.pebbles.length
    ? `<ol class="lf">${content.pebbles
        .map((pebble) => `<li>${titleLine(pebble.title, pebble.artist, pebble.rank)}</li>`)
        .join('')}</ol>`
    : ''

  const boulders = content.boulders.length
    ? `<p class="lf-h">${escapeHtml(content.neverLeaveLabel)}</p>` +
      `<ul class="lf">${content.boulders
        .map(
          (boulder) =>
            `<li>${titleLine(boulder.album, boulder.artist)}` +
            `<span class="lf-l">${escapeHtml(boulder.line)}</span></li>`,
        )
        .join('')}</ul>`
    : ''

  return `${style}<div class="column">${pebbles}${boulders}</div>`
}
