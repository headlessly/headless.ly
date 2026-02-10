/**
 * headlessly() — Node-specific initialization for @headlessly/node
 *
 * Wraps @headlessly/sdk with Node.js-specific features:
 * - Auto-reads HEADLESSLY_ENDPOINT, HEADLESSLY_API_KEY, HEADLESSLY_TENANT env vars
 * - Supports mode: 'local' (file-based via LocalNounProvider)
 * - Supports mode: 'remote' (via RemoteNounProvider / rpc.do)
 * - Supports mode: 'memory' (default in-memory for testing)
 * - Auto-detect: env vars present with endpoint+apiKey → remote, otherwise → memory
 */

/**
 * Options for the headlessly() Node.js initialization
 */
export interface HeadlesslyNodeOptions {
  /** API endpoint URL (default: reads HEADLESSLY_ENDPOINT env var) */
  endpoint?: string
  /** API key (default: reads HEADLESSLY_API_KEY env var) */
  apiKey?: string
  /** Tenant identifier (default: reads HEADLESSLY_TENANT env var) */
  tenant?: string
  /**
   * Provider mode:
   * - 'local': File-based storage with LocalNounProvider
   * - 'remote': Remote via RemoteNounProvider (rpc.do)
   * - 'memory': In-memory (default when no env vars)
   * - undefined: Auto-detect from env vars
   */
  mode?: 'local' | 'remote' | 'memory'
  /** Path for local file storage (default: '.headlessly/') */
  localPath?: string
  /** Path for NDJSON event log (default: '.headlessly/events.ndjson') */
  eventsPath?: string
}

/**
 * Result of headlessly() initialization
 */
export interface HeadlesslyNodeResult {
  /** The resolved provider mode */
  mode: 'local' | 'remote' | 'memory'
  /** The resolved endpoint (if remote) */
  endpoint?: string
  /** The resolved tenant */
  tenant?: string
  /** The resolved API key (if remote) */
  apiKey?: string
}

/**
 * Read an environment variable, returning undefined if not set
 */
function readEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || undefined
  }
  return undefined
}

/**
 * Resolve the provider mode from options and environment
 */
function resolveMode(options: HeadlesslyNodeOptions): 'local' | 'remote' | 'memory' {
  if (options.mode) return options.mode

  // Auto-detect: if endpoint and apiKey are available, use remote
  const endpoint = options.endpoint ?? readEnv('HEADLESSLY_ENDPOINT')
  const apiKey = options.apiKey ?? readEnv('HEADLESSLY_API_KEY')

  if (endpoint && apiKey) return 'remote'
  return 'memory'
}

/**
 * headlessly() — Initialize the Node.js SDK
 *
 * Reads configuration from options and environment variables:
 * - HEADLESSLY_ENDPOINT — API endpoint URL
 * - HEADLESSLY_API_KEY — API key for authentication
 * - HEADLESSLY_TENANT — Tenant identifier
 *
 * Auto-detects mode: if endpoint + apiKey are available, uses remote.
 * Otherwise defaults to in-memory.
 *
 * @example
 * ```typescript
 * import { headlessly } from '@headlessly/node'
 *
 * // Auto-detect from env vars
 * const result = headlessly()
 *
 * // Explicit remote mode
 * const result = headlessly({
 *   mode: 'remote',
 *   endpoint: 'https://db.headless.ly',
 *   apiKey: 'hly_sk_...',
 *   tenant: 'acme',
 * })
 *
 * // Local file-based mode
 * const result = headlessly({ mode: 'local', tenant: 'acme' })
 * ```
 */
export function headlessly(options: HeadlesslyNodeOptions = {}): HeadlesslyNodeResult {
  const endpoint = options.endpoint ?? readEnv('HEADLESSLY_ENDPOINT')
  const apiKey = options.apiKey ?? readEnv('HEADLESSLY_API_KEY')
  const tenant = options.tenant ?? readEnv('HEADLESSLY_TENANT')
  const mode = resolveMode(options)

  return {
    mode,
    endpoint: mode === 'remote' ? endpoint : undefined,
    apiKey: mode === 'remote' ? apiKey : undefined,
    tenant,
  }
}
