import { useState, useEffect } from 'react'

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item !== null ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      if (e?.name === 'QuotaExceededError') {
        window.dispatchEvent(new CustomEvent('aify:storage_full'))
      }
    }
  }, [key, value])

  return [value, setValue]
}

// Read-only: read from localStorage once
export function readLocalStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(key)
    return item !== null ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

// Write directly to localStorage (outside React)
export function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('aify:storage_full'))
    }
    return false
  }
}
