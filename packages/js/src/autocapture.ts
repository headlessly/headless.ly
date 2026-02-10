/**
 * @headlessly/js - Auto-capture
 *
 * Optional automatic capture of browser events:
 * - Page views (on route change)
 * - Click events (with element metadata)
 * - Form submissions
 */

// =============================================================================
// Types
// =============================================================================

export interface AutoCaptureConfig {
  /** Auto-capture page views (default: false) */
  pageViews?: boolean
  /** Auto-capture click events (default: false) */
  clicks?: boolean
  /** Auto-capture form submissions (default: false) */
  formSubmissions?: boolean
  /** CSS selector to filter click capture (default: 'a, button, [role="button"], input[type="submit"]') */
  clickSelector?: string
  /** Attributes to capture from elements (default: ['id', 'class', 'href', 'name', 'type', 'role']) */
  captureAttributes?: string[]
}

export interface AutoCaptureTracker {
  track: (event: string, properties?: Record<string, unknown>) => void
  page: (name?: string, properties?: Record<string, unknown>) => void
}

// =============================================================================
// Auto-capture Manager
// =============================================================================

export class AutoCaptureManager {
  private config: AutoCaptureConfig
  private tracker: AutoCaptureTracker
  private teardownFns: (() => void)[] = []
  private lastUrl: string = ''
  private enabled = false

  constructor(config: AutoCaptureConfig, tracker: AutoCaptureTracker) {
    this.config = {
      clickSelector: 'a, button, [role="button"], input[type="submit"]',
      captureAttributes: ['id', 'class', 'href', 'name', 'type', 'role'],
      ...config,
    }
    this.tracker = tracker
  }

  start(): void {
    if (this.enabled) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (typeof window.addEventListener !== 'function') return

    this.enabled = true

    if (this.config.pageViews) {
      this.setupPageViewCapture()
    }

    if (this.config.clicks) {
      this.setupClickCapture()
    }

    if (this.config.formSubmissions) {
      this.setupFormCapture()
    }
  }

  stop(): void {
    this.enabled = false
    for (const fn of this.teardownFns) {
      try {
        fn()
      } catch {}
    }
    this.teardownFns = []
  }

  // ===========================================================================
  // Page View Auto-capture
  // ===========================================================================

  private setupPageViewCapture(): void {
    try {
      this.lastUrl = location.href
    } catch {}

    // Capture initial page view
    this.capturePageView()

    // Listen for History API changes
    try {
      const origPushState = typeof history !== 'undefined' ? history.pushState?.bind(history) : undefined
      const origReplaceState = typeof history !== 'undefined' ? history.replaceState?.bind(history) : undefined

      if (origPushState) {
        history.pushState = (...args: Parameters<typeof history.pushState>) => {
          origPushState(...args)
          this.onUrlChange()
        }
      }

      if (origReplaceState) {
        history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
          origReplaceState(...args)
          this.onUrlChange()
        }
      }

      const popstateHandler = () => this.onUrlChange()
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('popstate', popstateHandler)
      }

      this.teardownFns.push(() => {
        if (origPushState && typeof history !== 'undefined') history.pushState = origPushState
        if (origReplaceState && typeof history !== 'undefined') history.replaceState = origReplaceState
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('popstate', popstateHandler)
        }
      })
    } catch {}
  }

  private onUrlChange(): void {
    try {
      const newUrl = location.href
      if (newUrl !== this.lastUrl) {
        this.lastUrl = newUrl
        this.capturePageView()
      }
    } catch {}
  }

  private capturePageView(): void {
    try {
      this.tracker.page(document.title, {
        url: location.href,
        path: location.pathname,
        search: location.search,
        hash: location.hash,
      })
    } catch {}
  }

  // ===========================================================================
  // Click Auto-capture
  // ===========================================================================

  private setupClickCapture(): void {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      // Walk up the DOM to find the matching element
      const el = target.closest(this.config.clickSelector!) as HTMLElement | null
      if (!el) return

      const props = this.extractElementProps(el)
      this.tracker.track('$click', props)
    }

    document.addEventListener('click', handler, { capture: true })
    this.teardownFns.push(() => document.removeEventListener('click', handler, { capture: true }))
  }

  // ===========================================================================
  // Form Auto-capture
  // ===========================================================================

  private setupFormCapture(): void {
    const handler = (event: SubmitEvent | Event) => {
      const form = event.target as HTMLFormElement | null
      if (!form || form.tagName !== 'FORM') return

      const props = this.extractElementProps(form)
      props.$form_action = form.action || undefined
      props.$form_method = form.method || undefined

      this.tracker.track('$form_submit', props)
    }

    document.addEventListener('submit', handler, { capture: true })
    this.teardownFns.push(() => document.removeEventListener('submit', handler, { capture: true }))
  }

  // ===========================================================================
  // Element Property Extraction
  // ===========================================================================

  private extractElementProps(el: HTMLElement): Record<string, unknown> {
    const props: Record<string, unknown> = {
      $tag_name: el.tagName.toLowerCase(),
      $text: this.getElementText(el),
    }

    for (const attr of this.config.captureAttributes ?? []) {
      const value = el.getAttribute(attr)
      if (value) {
        props[`$attr_${attr}`] = value
      }
    }

    return props
  }

  private getElementText(el: HTMLElement): string {
    const text = (el.textContent || el.innerText || '').trim()
    // Truncate long text
    return text.length > 255 ? text.slice(0, 255) + '...' : text
  }
}
