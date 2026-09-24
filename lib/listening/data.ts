/**
 * Everything /listening needs, in one call.
 *
 * Server-only: it reads content/listening.json and it reads the environment.
 * The page hands the RESULT to a client component, and the result contains
 * album names, playcounts and image URLs — never a credential.
 */

import { resolveBoulders, resolveHideList } from './boulders.ts'
import { LISTENING_PERIOD } from './constants.ts'
import { loadListeningFile } from './file.ts'
import { loadPebbles } from './lastfm.ts'
import type { ListeningData } from './types.ts'

export async function getListeningData(): Promise<ListeningData> {
  const file = loadListeningFile()
  // The hide list applies to the pebbles only. A boulder is a deliberate
  // choice and hiding one would mean deleting it, which is what the file is
  // for.
  const { pebbles, asOf, source } = await loadPebbles({ hide: resolveHideList(file) })

  return {
    pebbles,
    boulders: resolveBoulders(file),
    period: LISTENING_PERIOD,
    asOf,
    source,
  }
}
