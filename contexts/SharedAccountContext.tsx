'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getMySharedAccount,
  getSharedAccountMembers,
  countSharedCategories,
} from '@/services/sharedAccountService'
import type { SharedAccount, SharedAccountMemberWithProfile } from '@/types/sharedAccount'

interface SharedAccountCtx {
  sharedAccount: SharedAccount | null
  members: SharedAccountMemberWithProfile[]
  myMembership: SharedAccountMemberWithProfile | null
  unifiedMode: boolean
  filterUserId: string | null
  setUnifiedMode: (v: boolean) => void
  setFilterUserId: (id: string | null) => void
  loading: boolean
  needsCategorySetup: boolean
  markSetupDone: () => void
  clearAccount: () => void
  refresh: () => void
  lastSharedUpdate: number
  broadcastChange: () => void
}

const SharedAccountContext = createContext<SharedAccountCtx>({
  sharedAccount: null,
  members: [],
  myMembership: null,
  unifiedMode: false,
  filterUserId: null,
  setUnifiedMode: () => {},
  setFilterUserId: () => {},
  loading: true,
  needsCategorySetup: false,
  markSetupDone: () => {},
  clearAccount: () => {},
  refresh: () => {},
  lastSharedUpdate: 0,
  broadcastChange: () => {},
})

export function SharedAccountProvider({ children }: { children: ReactNode }) {
  const [sharedAccount, setSharedAccount] = useState<SharedAccount | null>(null)
  const [members, setMembers] = useState<SharedAccountMemberWithProfile[]>([])
  const [myMembership, setMyMembership] = useState<SharedAccountMemberWithProfile | null>(null)
  const [unifiedMode, setUnifiedModeState] = useState(false)
  const [filterUserId, setFilterUserIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsCategorySetup, setNeedsCategorySetup] = useState(false)
  const [lastSharedUpdate, setLastSharedUpdate] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const account = await getMySharedAccount()
      setSharedAccount(account)

      if (account && user) {
        const ms = await getSharedAccountMembers(account.id)
        setMembers(ms)
        setMyMembership(ms.find((m) => m.user_id === user.id) ?? null)

        if (ms.length >= 2) {
          // Restore persisted mode; default to unified when account has 2+ members
          const savedMode = localStorage.getItem(`unified_mode_${account.id}`)
          if (savedMode !== null) {
            setUnifiedModeState(savedMode === 'true')
            const savedFilter = localStorage.getItem(`filter_user_${account.id}`)
            setFilterUserIdState(savedFilter ?? null)
          } else {
            setUnifiedModeState(true)
            localStorage.setItem(`unified_mode_${account.id}`, 'true')
          }
        } else {
          setUnifiedModeState(false)
          setFilterUserIdState(null)
        }

        // Check if owner needs to configure shared categories
        const isOwner = account.created_by === user.id
        const hasEnoughMembers = ms.length >= 2
        const setupDoneKey = `shared_setup_done_${account.id}`
        const setupDoneInStorage = typeof window !== 'undefined' && localStorage.getItem(setupDoneKey) === '1'

        if (isOwner && hasEnoughMembers && !setupDoneInStorage) {
          const catCount = await countSharedCategories(account.id)
          setNeedsCategorySetup(catCount === 0)
        } else {
          setNeedsCategorySetup(false)
        }
      } else {
        setMembers([])
        setMyMembership(null)
        setNeedsCategorySetup(false)
        setUnifiedModeState(false)
        setFilterUserIdState(null)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Real-time broadcast channel — notifies partner of transaction changes
  useEffect(() => {
    if (!sharedAccount || members.length < 2) {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      return
    }
    const supabase = createClient()
    const channel = supabase
      .channel(`shared:${sharedAccount.id}`)
      .on('broadcast', { event: 'tx_change' }, () => {
        setLastSharedUpdate(Date.now())
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [sharedAccount?.id, members.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function broadcastChange() {
    if (!channelRef.current) return
    channelRef.current.send({ type: 'broadcast', event: 'tx_change', payload: {} }).catch(() => {})
  }

  function setUnifiedMode(v: boolean) {
    if (!sharedAccount && v) return
    setUnifiedModeState(v)
    if (!v) setFilterUserIdState(null)
    if (sharedAccount) {
      localStorage.setItem(`unified_mode_${sharedAccount.id}`, String(v))
      if (!v) localStorage.removeItem(`filter_user_${sharedAccount.id}`)
    }
  }

  function setFilterUserId(id: string | null) {
    setFilterUserIdState(id)
    if (sharedAccount) {
      if (id) localStorage.setItem(`filter_user_${sharedAccount.id}`, id)
      else localStorage.removeItem(`filter_user_${sharedAccount.id}`)
    }
  }

  function clearAccount() {
    setSharedAccount(null)
    setMembers([])
    setMyMembership(null)
    setNeedsCategorySetup(false)
    setUnifiedModeState(false)
    setFilterUserIdState(null)
  }

  function markSetupDone() {
    if (sharedAccount) {
      localStorage.setItem(`shared_setup_done_${sharedAccount.id}`, '1')
    }
    setNeedsCategorySetup(false)
  }

  return (
    <SharedAccountContext.Provider value={{
      sharedAccount,
      members,
      myMembership,
      unifiedMode,
      filterUserId,
      setUnifiedMode,
      setFilterUserId,
      loading,
      needsCategorySetup,
      markSetupDone,
      clearAccount,
      refresh: load,
      lastSharedUpdate,
      broadcastChange,
    }}>
      {children}
    </SharedAccountContext.Provider>
  )
}

export function useSharedAccount() { return useContext(SharedAccountContext) }
