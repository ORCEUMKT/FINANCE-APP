'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, X, SlidersHorizontal } from 'lucide-react'
import { AccountViewSelector } from '@/components/shared/AccountViewSelector'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { TransactionCard } from '@/components/transactions/TransactionCard'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { VoiceMicButton } from '@/components/ui/VoiceMicButton'
import { MonthPicker, monthRange, type MonthValue } from '@/components/ui/MonthPicker'
import { useSelectedMonth } from '@/contexts/MonthContext'
import { useSharedAccount } from '@/contexts/SharedAccountContext'
import { getSharedTransactions } from '@/services/sharedAccountService'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/formatters'
import { parseVoiceInput, type VoicePrefill } from '@/lib/voiceParser'
import type { Transaction, TransactionInsert } from '@/types/transaction'
import type { SubmitOptions } from '@/components/transactions/TransactionForm'

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsContent />
    </Suspense>
  )
}

function TransactionsContent() {
  const params = useSearchParams()
  const { toast } = useToast()

  const { month: selectedMonth, setMonth: setSelectedMonth } = useSelectedMonth()
  const { dateFrom: mFrom, dateTo: mTo } = monthRange(selectedMonth)

  const [search, setSearch]       = useState(params.get('search') ?? '')
  const [catFilter, setCatFilter] = useState(params.get('category') ?? '')
  const [dateFrom, setDateFrom]   = useState(params.get('date_from') ?? mFrom)
  const [dateTo, setDateTo]       = useState(params.get('date_to') ?? mTo)
  // Default to value sort when coming from a category click
  const [sortBy, setSortBy]       = useState<'date' | 'value'>(() => params.get('category') ? 'value' : 'date')

  function applyMonth(v: MonthValue) {
    setSelectedMonth(v)
    const { dateFrom: f, dateTo: t } = monthRange(v)
    setDateFrom(f)
    setDateTo(t)
  }
  const [showFilters, setShowFilters] = useState(false)
  const [formOpen, setFormOpen]         = useState(() => params.get('new') === '1')
  const [editing, setEditing]           = useState<Transaction | null>(null)
  const [voicePrefill, setVoicePrefill]   = useState<VoicePrefill | null>(null)
  const [duplicating, setDuplicating]     = useState<Transaction | null>(null)
  const [deletedBuffer, setDeletedBuffer] = useState<Transaction | null>(null)

  const filters = {
    search: search || undefined,
    category_id: catFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    sort_by: sortBy,
  }

  const { transactions, loading, refetch, add, update, remove, markRecovered, removeGroup, updateGroupDates } = useTransactions(filters)
  const { categories } = useCategories()
  const { sharedAccount, unifiedMode, filterUserId, members, myMembership, setUnifiedMode, setFilterUserId } = useSharedAccount()

  // Unified transactions state
  const [unifiedTxs, setUnifiedTxs]           = useState<Transaction[]>([])
  const [unifiedLoading, setUnifiedLoading]   = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!unifiedMode || !sharedAccount) { setUnifiedTxs([]); return }
    setUnifiedLoading(true)
    getSharedTransactions(sharedAccount.id, dateFrom || undefined, dateTo || undefined, filterUserId)
      .then(setUnifiedTxs)
      .catch(() => setUnifiedTxs([]))
      .finally(() => setUnifiedLoading(false))
  }, [unifiedMode, sharedAccount?.id, filterUserId, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayTxs     = unifiedMode ? (search ? unifiedTxs.filter(t => t.description.toLowerCase().includes(search.toLowerCase())) : unifiedTxs) : transactions
  const displayLoading = unifiedMode ? unifiedLoading : loading

  const handleSubmit = useCallback(async (data: TransactionInsert, options?: SubmitOptions) => {
    if (editing) {
      if (options?.cascadeDates && data.date !== editing.date) {
        await updateGroupDates(editing, data.date)
        await update(editing.id, data)
        refetch()
      } else {
        await update(editing.id, data)
      }
      toast('Lançamento atualizado!')
    } else {
      await add(data)
      toast('Lançamento adicionado!')
    }
    setEditing(null)
    setFormOpen(false)
  }, [editing, add, update, updateGroupDates, refetch, toast])

  const handleDelete = useCallback(async (id: string) => {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return
    setDeletedBuffer(tx)
    await remove(id)
    toast('Lançamento excluído.', {
      action: {
        label: 'Desfazer',
        onClick: async () => {
          if (!deletedBuffer) return
          await add({
            description: deletedBuffer.description,
            value: deletedBuffer.value,
            date: deletedBuffer.date,
            category_id: deletedBuffer.category_id,
            type: deletedBuffer.type,
            status: deletedBuffer.status,
            notes: deletedBuffer.notes,
          })
          toast('Exclusão desfeita!')
        },
      },
    })
  }, [transactions, remove, add, toast, deletedBuffer])

  const handleDeleteGroup = useCallback(async (tx: Transaction) => {
    await removeGroup(tx)
    toast('Todas as parcelas excluídas!')
  }, [removeGroup, toast])

  const handleDuplicate = useCallback((id: string) => {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return
    setDuplicating(tx)
    setEditing(null)
    setVoicePrefill(null)
    setFormOpen(true)
  }, [transactions])

  const handleMarkRecovered = useCallback(async (id: string) => {
    await markRecovered(id)
    toast('Marcado como recuperado!')
  }, [markRecovered, toast])

  function clearFilters() {
    setSearch('')
    setCatFilter('')
    setSortBy('date')
    const { dateFrom: f, dateTo: t } = monthRange(selectedMonth)
    setDateFrom(f)
    setDateTo(t)
  }
  const hasFilters = search || catFilter
  const total = displayTxs.reduce((s, t) => s + t.value, 0)

  // Account view selector (mirrored from dashboard)
  const viewOptions = sharedAccount && members.length >= 2
    ? [
        { key: 'personal', label: 'Minha conta', userId: null, unified: false },
        { key: 'all', label: 'Conta unificada', userId: null, unified: true },
        ...members
          .filter((m) => m.user_id !== myMembership?.user_id)
          .map((m) => ({ key: m.user_id, label: m.name || 'Membro', userId: m.user_id, unified: true })),
      ]
    : null
  const activeViewKey = !unifiedMode ? 'personal' : (filterUserId ?? 'all')
  function selectView(key: string) {
    if (key === 'personal') { setUnifiedMode(false); return }
    setUnifiedMode(true)
    setFilterUserId(key === 'all' ? null : key)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Account selector — first on mobile */}
      {viewOptions && (
        <div className="lg:hidden">
          <AccountViewSelector options={viewOptions} activeKey={activeViewKey} onChange={selectView} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Extrato</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {displayLoading ? 'Carregando…' : `${displayTxs.length} lançamentos · ${formatCurrency(total)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {viewOptions && (
            <div className="hidden lg:block">
              <AccountViewSelector options={viewOptions} activeKey={activeViewKey} onChange={selectView} />
            </div>
          )}
          <MonthPicker value={selectedMonth} onChange={applyMonth} />
          <VoiceMicButton
            onResult={(transcript) => {
              const parsed = parseVoiceInput(transcript)
              toast(`Detectado: "${transcript}"`)
              setVoicePrefill(parsed)
              setEditing(null)
              setFormOpen(true)
            }}
            onError={(msg) => toast(msg)}
          />
          <Button onClick={() => { setVoicePrefill(null); setEditing(null); setFormOpen(true) }} size="sm" className="gap-1.5">
            <Plus size={13} /> Novo
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              className="w-full bg-white/[.05] border border-white/[.09] rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 focus:bg-white/[.07] transition-all"
              placeholder="Buscar lançamento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`w-11 h-11 flex items-center justify-center rounded-2xl border transition-all ${
              showFilters || hasFilters ? 'bg-white/[.1] border-white/20 text-white' : 'bg-white/[.04] border-white/[.09] text-white/40 hover:text-white hover:bg-white/[.07]'
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-white/[.03] border border-white/[.07] rounded-2xl flex flex-col gap-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/30">Categoria</label>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="h-10 bg-white/[.05] border border-white/[.09] rounded-xl px-3 text-sm text-white outline-none"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/30">De</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 bg-white/[.05] border border-white/[.09] rounded-xl px-3 text-sm text-white outline-none" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/30">Até</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 bg-white/[.05] border border-white/[.09] rounded-xl px-3 text-sm text-white outline-none" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/30">Ordenar por</label>
                <div className="flex h-10 rounded-xl overflow-hidden border border-white/[.09]">
                  {(['date', 'value'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className="flex-1 text-[11px] font-semibold transition-all"
                      style={{
                        background: sortBy === opt ? 'var(--accent)' : 'transparent',
                        color: sortBy === opt ? 'var(--accent-text)' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {opt === 'date' ? 'Data' : 'Valor'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={clearFilters} className="self-start text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1.5">
              <X size={11} /> Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {displayLoading ? (
        <div className="flex justify-center py-14">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : displayTxs.length > 0 ? (
        <div className="flex flex-col gap-2">
          {displayTxs.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              onEdit={(t) => { setEditing(t); setFormOpen(true) }}
              onDelete={handleDelete}
              onDeleteGroup={handleDeleteGroup}
              onDuplicate={handleDuplicate}
              onMarkRecovered={handleMarkRecovered}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title={hasFilters ? 'Nenhum resultado' : 'Sem lançamentos'}
          description={hasFilters ? 'Tente ajustar os filtros' : 'Clique em "Novo" para adicionar seu primeiro lançamento'}
          action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Limpar filtros</Button> : undefined}
        />
      )}

      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); setVoicePrefill(null); setDuplicating(null) }}
        onSubmit={handleSubmit}
        categories={categories}
        editingTransaction={editing}
        prefill={voicePrefill}
        prefillFrom={duplicating}
      />
    </div>
  )
}
