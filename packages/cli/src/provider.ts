/**
 * Provider initialization for CLI
 *
 * Resolves the correct NounProvider based on config:
 * - memory: MemoryNounProvider (default, in-process)
 * - local: MemoryNounProvider with local data directory
 * - remote: HTTP client targeting db.headless.ly
 *
 * The global provider from digital-objects is the source of truth.
 * If setProvider() was called externally (e.g. in tests), we respect that.
 */

import type { NounProvider } from 'digital-objects'
import { getProvider as getGlobalProvider } from 'digital-objects'

/**
 * Get the active NounProvider.
 *
 * Returns the global provider from digital-objects.
 * If none is set, digital-objects creates a default MemoryNounProvider.
 * In the future, remote mode will configure an HTTP-based provider.
 */
export async function getProvider(): Promise<NounProvider> {
  return getGlobalProvider()
}
