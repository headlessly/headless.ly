/**
 * SearchBar — Universal search across all entity types.
 *
 * Provides a search input with a dropdown of results.
 * Uses the MCP `search` primitive under the hood (via useSearch hook).
 *
 * @example
 * ```tsx
 * import { SearchBar } from '@headlessly/ui'
 *
 * <SearchBar
 *   types={['Contact', 'Deal', 'Company']}
 *   onSelect={(result) => navigate(`/${result.type}/${result.entity.$id}`)}
 *   placeholder='Search contacts, deals...'
 * />
 * ```
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useSearch, type SearchResult } from './hooks/use-search.js'
import { searchStyles } from './styles.js'
import type { StylableProps } from './types.js'

export interface SearchBarProps extends StylableProps {
  /** Entity types to search across */
  types?: string[]
  /** Placeholder text */
  placeholder?: string
  /** Debounce delay in ms (default: 300) */
  debounce?: number
  /** Maximum results (default: 20) */
  limit?: number
  /** Called when a result is selected */
  onSelect?: (result: SearchResult) => void
  /** Whether the dropdown should close on select (default: true) */
  closeOnSelect?: boolean
  /** Custom result renderer */
  renderResult?: (result: SearchResult) => React.ReactNode
  /** Auto-focus the input on mount */
  autoFocus?: boolean
}

export function SearchBar({
  types,
  placeholder = 'Search...',
  debounce = 300,
  limit = 20,
  onSelect,
  closeOnSelect = true,
  renderResult,
  autoFocus = false,
  className,
  style,
}: SearchBarProps) {
  const { results, loading, error, query, search, clear } = useSearch({ types, debounce, limit })
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      search(e.target.value)
      setIsOpen(true)
      setHighlightIndex(-1)
    },
    [search],
  )

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelect?.(result)
      if (closeOnSelect) {
        setIsOpen(false)
        clear()
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [onSelect, closeOnSelect, clear],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightIndex((i) => Math.min(i + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (highlightIndex >= 0 && highlightIndex < results.length) {
            handleSelect(results[highlightIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          break
      }
    },
    [isOpen, results, highlightIndex, handleSelect],
  )

  const showDropdown = isOpen && query.trim().length > 0

  return (
    <div ref={wrapperRef} style={{ ...searchStyles.wrapper, ...(style ?? {}) }} className={className} data-testid='search-bar'>
      <input
        ref={inputRef}
        type='text'
        placeholder={placeholder}
        style={searchStyles.input}
        onChange={handleInputChange}
        onFocus={() => query.trim() && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        aria-label='Search'
        role='combobox'
        aria-expanded={showDropdown}
        aria-autocomplete='list'
      />

      {showDropdown && (
        <div style={searchStyles.dropdown} role='listbox' data-testid='search-dropdown'>
          {loading ? (
            <div style={searchStyles.loading}>Searching...</div>
          ) : error ? (
            <div style={{ ...searchStyles.noResults, color: 'var(--hly-danger, #dc2626)' }}>Search failed</div>
          ) : results.length === 0 ? (
            <div style={searchStyles.noResults}>No results for &quot;{query}&quot;</div>
          ) : (
            results.map((result, idx) => {
              // Custom renderer
              if (renderResult) {
                return (
                  <div
                    key={`${result.type}-${result.entity.$id}`}
                    style={{
                      ...searchStyles.resultItem,
                      backgroundColor: idx === highlightIndex ? 'var(--hly-bg-hover, #f9fafb)' : undefined,
                    }}
                    onClick={() => handleSelect(result)}
                    role='option'
                    aria-selected={idx === highlightIndex}
                  >
                    {renderResult(result)}
                  </div>
                )
              }

              const label = String(result.entity.name ?? result.entity.title ?? result.entity.email ?? result.entity.$id)

              return (
                <div
                  key={`${result.type}-${result.entity.$id}`}
                  style={{
                    ...searchStyles.resultItem,
                    backgroundColor: idx === highlightIndex ? 'var(--hly-bg-hover, #f9fafb)' : undefined,
                  }}
                  onClick={() => handleSelect(result)}
                  role='option'
                  aria-selected={idx === highlightIndex}
                  data-testid={`search-result-${result.entity.$id}`}
                >
                  <span style={searchStyles.resultType}>{result.type}</span>
                  <div>
                    <div style={searchStyles.resultTitle}>{label}</div>
                    <div style={searchStyles.resultId}>{result.entity.$id}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
