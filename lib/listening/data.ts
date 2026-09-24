/**
 * Everything /listening needs, in one call.
 *
 * Server-only: it reads content/listening.json and it reads the environment.
 * The page hands the RESULT to a client component, and the result contains
 * track names, playcounts and image URLs — never a credential.
 */

import { LISTENING_PERIOD } from './constants.ts'
import { loadListeningFile } from './file.ts'
import { resolveHideList } from './hide.ts'
import { loadPebbles } from './lastfm.ts'
import type { ListeningData } from './types.ts'

export async function getListeningData(): Promise<ListeningData> {
  const { pebbles, asOf, source } = await loadPebbles({
    hide: resolveHideList(loadListeningFile()),
  })
  return { pebbles, period: LISTENING_PERIOD, asOf, source }
}
