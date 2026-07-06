'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getMySharedAccount, getSharedAccountMembers } from '@/services/sharedAccountService'
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
  refresh: () => void
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
  refresh: () => {},
})

export function SharedAccountProvider({ children }: { children: ReactNode }) {
  const [sharedAccount, setSharedAccount] = useState<SharedAccount | null>(null)
  const [members, setMembers] = useState<SharedAccountMemberWithProfile[]>([])
  const [myMembership, setMyMembership] = useState<SharedAccountMemberWithProfile | null>(null)
  const [unifiedMode, setUnifiedModeState] = useState(false)
  const [filterUserId, setFilterUserIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const account = await getMySharedAccount()
      setSharedAccount(account)
      if (account) {
        const ms = await getSharedAccountMembers(account.id)
        setMembers(ms)
        // figure out current user from the auth — getMySharedAccount already validated membership
        setMyMembership(ms[0] ?? null) // will be resolved when we know userId
      } else {
        setMembers([])
        setMyMembership(null)
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

  function setUnifiedMode(v: boolean) {
    if (!sharedAccount && v) return
    setUnifiedModeState(v)
    if (!v) setFilterUserIdState(null)
  }

  function setFilterUserId(id: string | null) {
    setFilterUserIdState(id)
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
      refresh: load,
    }}>
      {children}
    </SharedAccountContext.Provider>
  )
}

export function useSharedAccount() { return useContext(SharedAccountContext) }
