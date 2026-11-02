import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __twentyNineInstallPrompt?: BeforeInstallPromptEvent
  }
}

const INSTALL_READY_EVENT = 'twenty-nine-install-ready'

// Capture the browser prompt as soon as this module loads, before React mounts,
// so a fast cached launch cannot miss it.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    window.__twentyNineInstallPrompt = event as BeforeInstallPromptEvent
    window.dispatchEvent(new Event(INSTALL_READY_EVENT))
  })
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(() => typeof window === 'undefined' ? null : window.__twentyNineInstallPrompt ?? null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onReady = () => setPromptEvent(window.__twentyNineInstallPrompt ?? null)
    const onInstalled = () => {
      window.__twentyNineInstallPrompt = undefined
      setInstalled(true)
      setPromptEvent(null)
    }
    const media = window.matchMedia('(display-mode: standalone)')
    const onDisplayMode = () => setInstalled(media.matches)

    window.addEventListener(INSTALL_READY_EVENT, onReady)
    window.addEventListener('appinstalled', onInstalled)
    media.addEventListener('change', onDisplayMode)
    return () => {
      window.removeEventListener(INSTALL_READY_EVENT, onReady)
      window.removeEventListener('appinstalled', onInstalled)
      media.removeEventListener('change', onDisplayMode)
    }
  }, [])

  async function install(): Promise<boolean> {
    const event = promptEvent ?? window.__twentyNineInstallPrompt
    if (!event) return false
    await event.prompt()
    const choice = await event.userChoice
    window.__twentyNineInstallPrompt = undefined
    setPromptEvent(null)
    if (choice.outcome === 'accepted') setInstalled(true)
    return choice.outcome === 'accepted'
  }

  return {
    canInstall: !!promptEvent && !installed,
    installed,
    isIos: isIos(),
    install,
  }
}
