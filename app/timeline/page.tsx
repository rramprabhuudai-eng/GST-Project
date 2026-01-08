'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getPeriodLabel } from '@/lib/gst/deadline-generator'
import {
  getDeadlineCountdown,
  formatDate,
  getStatusColor,
  getUrgencyColor
} from '@/lib/utils/date-utils'
import { addDays, format, startOfMonth } from 'date-fns'

interface GSTEntity {
  id: string
  gstin: string
  legal_name: string
  trade_name: string | null
  filing_frequency: 'monthly' | 'quarterly'
}

interface GSTDeadline {
  id: string
  entity_id: string
  return_type: string
  period_month: number
  period_year: number
  due_date: string
  status: 'upcoming' | 'filed' | 'overdue'
  filed_at: string | null
  proof_url: string | null
}

interface DeadlineWithEntity extends GSTDeadline {
  entity: GSTEntity
}

interface GroupedDeadlines {
  [month: string]: DeadlineWithEntity[]
}

export default function TimelinePage() {
  const [entities, setEntities] = useState<GSTEntity[]>([])
  const [deadlines, setDeadlines] = useState<DeadlineWithEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingDeadlines, setGeneratingDeadlines] = useState(false)
  const [markingFiled, setMarkingFiled] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)

      // Fetch all entities
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('gst_entities')
        .select('*')
        .order('legal_name')

      if (entitiesError) throw entitiesError

      setEntities(entitiesData || [])

      if (!entitiesData || entitiesData.length === 0) {
        setError('No GST entities found. Please add an entity first.')
        setLoading(false)
        return
      }

      // Fetch deadlines for next 90 days
      const today = new Date()
      const futureDate = addDays(today, 90)

      const { data: deadlinesData, error: deadlinesError } = await supabase
        .from('gst_deadlines')
        .select('*')
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .lte('due_date', format(futureDate, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true })

      if (deadlinesError) throw deadlinesError

      // Combine deadlines with entity data
      const deadlinesWithEntities: DeadlineWithEntity[] = (deadlinesData || []).map(deadline => {
        const entity = entitiesData.find(e => e.id === deadline.entity_id)
        return {
          ...deadline,
          entity: entity!
        }
      }).filter(d => d.entity) // Filter out deadlines without entities

      setDeadlines(deadlinesWithEntities)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  async function generateDeadlines(entityId: string) {
    try {
      setGeneratingDeadlines(true)
      setError(null)

      const response = await fetch('/api/deadlines/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate deadlines')
      }

      // Refresh data
      await fetchData()

    } catch (err) {
      console.error('Error generating deadlines:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate deadlines')
    } finally {
      setGeneratingDeadlines(false)
    }
  }

  async function markAsFiled(deadlineId: string) {
    try {
      setMarkingFiled(deadlineId)
      setError(null)

      const response = await fetch('/api/deadlines/mark-filed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline_id: deadlineId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark as filed')
      }

      // Refresh data
      await fetchData()

    } catch (err) {
      console.error('Error marking as filed:', err)
      setError(err instanceof Error ? err.message : 'Failed to mark as filed')
    } finally {
      setMarkingFiled(null)
    }
  }

  // Group deadlines by month
  function groupDeadlinesByMonth(deadlines: DeadlineWithEntity[]): GroupedDeadlines {
    const grouped: GroupedDeadlines = {}

    deadlines.forEach(deadline => {
      const monthKey = format(new Date(deadline.due_date), 'MMMM yyyy')
      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(deadline)
    })

    return grouped
  }

  const groupedDeadlines = groupDeadlinesByMonth(deadlines)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading timeline...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GST Filing Timeline</h1>
          <p className="text-gray-600">Track and manage your upcoming GST return deadlines</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Entities Section */}
        {entities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your GST Entities</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {entities.map(entity => (
                <div key={entity.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{entity.legal_name}</h3>
                      {entity.trade_name && (
                        <p className="text-sm text-gray-600">{entity.trade_name}</p>
                      )}
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {entity.filing_frequency}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">GSTIN: {entity.gstin}</p>
                  <button
                    onClick={() => generateDeadlines(entity.id)}
                    disabled={generatingDeadlines}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {generatingDeadlines ? 'Generating...' : 'Generate Deadlines'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deadlines Timeline */}
        {deadlines.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming Deadlines</h3>
            <p className="text-gray-600 mb-4">
              {entities.length > 0
                ? 'Click "Generate Deadlines" above to create your filing schedule'
                : 'Add a GST entity to get started'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-gray-900">Upcoming Deadlines (Next 90 Days)</h2>

            {Object.entries(groupedDeadlines).map(([month, monthDeadlines]) => (
              <div key={month}>
                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
                  {month}
                </h3>
                <div className="grid gap-4">
                  {monthDeadlines.map(deadline => (
                    <div
                      key={deadline.id}
                      className={`bg-white border-l-4 ${getUrgencyColor(deadline.due_date)} rounded-lg shadow-sm hover:shadow-md transition-shadow p-4`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        {/* Deadline Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">
                                {deadline.return_type}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {deadline.entity.legal_name}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(deadline.status)}`}>
                              {deadline.status.charAt(0).toUpperCase() + deadline.status.slice(1)}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Period: {getPeriodLabel(deadline.period_month, deadline.period_year, deadline.entity.filing_frequency)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Due: {formatDate(deadline.due_date)}</span>
                            </div>
                          </div>

                          <div className="mt-2">
                            <span className={`text-sm font-medium ${
                              deadline.status === 'overdue' ? 'text-red-600' :
                              deadline.status === 'filed' ? 'text-green-600' :
                              'text-blue-600'
                            }`}>
                              {deadline.status === 'filed'
                                ? `Filed on ${formatDate(deadline.filed_at!)}`
                                : getDeadlineCountdown(deadline.due_date)
                              }
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        {deadline.status === 'upcoming' && (
                          <button
                            onClick={() => markAsFiled(deadline.id)}
                            disabled={markingFiled === deadline.id}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors whitespace-nowrap"
                          >
                            {markingFiled === deadline.id ? 'Marking...' : 'Mark as Filed'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
