/**
 * Slow rings from a stone, like a speaker cone.
 *
 * The listening stone gives off a soft ring every couple of seconds. It is
 * built out of the ripple system that already exists — a ring is just a
 * ripple dropped at the stone's centre on a timer — so it costs no new
 * rendering and it behaves exactly like every other disturbance in the water.
 *
 * It has to read as the pond breathing, not as a notification. So: weaker than
 * a koi's wake is at its strongest, slower than a heartbeat, and never on two
 * consecutive frames. The ring starts under the stone, and the stone is drawn
 * over the water, so what you actually see is a ring emerging from the rim.
 *
 * Pure. The pond owns the clock and decides whether the stone is on screen.
 */

/** Seconds between rings. Inside the 1.5–2s the brief asked for. */
export const RING_INTERVAL = 1.8

/**
 * How strong a ring is.
 *
 * Calibrated by measuring the page, not by comparison with other numbers. At
 * 0.2 — the obvious "quieter than the pointer" guess — a ring was invisible:
 * the field takes a ripple at a third of its strength, and a single ring that
 * faint never lifts a cell past the blank at the bottom of the ramp. At 1.0
 * the trough bit into the stone's own rim. At 0.6 the stone reads as a cone:
 * its outer dots draw in as the trough passes and push out as the crest does,
 * and a faint halo travels off it.
 *
 * Still well below the pointer in the way that matters. The pointer drops a
 * 0.45 ripple every 110ms while it moves — about four units of disturbance a
 * second — where this is one 0.6 ring every 1.8 seconds.
 */
export const RING_STRENGTH = 0.6

/**
 * Is a ring due?
 *
 * `lastAt` is null before the first one, which is due immediately: a stone
 * that scrolls into view and then waits two seconds to do anything reads as
 * inert. After a pause — off-screen, or a backgrounded tab — the next ring is
 * due at once rather than making up for every ring it missed. A backlog of
 * rings released together is an alert, which is the one thing this must not
 * look like.
 */
export function ringDue(lastAt: number | null, now: number, interval = RING_INTERVAL): boolean {
  if (!Number.isFinite(now)) return false
  if (lastAt === null || !Number.isFinite(lastAt)) return true
  return now - lastAt >= interval
}
