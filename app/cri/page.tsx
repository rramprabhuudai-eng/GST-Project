'use client';

/**
 * CRI (Compliance Reliability Index) Display Page
 * Shows user's compliance score with dimension breakdown
 */

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getGradeColor, getScoreInterpretation } from '@/lib/cri/calculator';
import { CRIScoreRecord, DimensionScore } from '@/lib/cri/types';

interface GSTEntity {
  id: string;
  gstin: string;
  legal_name: string;
}

export default function CRIPage() {
  const [entities, setEntities] = useState<GSTEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [criScore, setCriScore] = useState<CRIScoreRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  // Fetch user's GST entities
  useEffect(() => {
    async function fetchEntities() {
      try {
        const { data, error } = await supabase
          .from('gst_entities')
          .select('id, gstin, legal_name')
          .order('legal_name');

        if (error) throw error;

        setEntities(data || []);

        // Auto-select first entity
        if (data && data.length > 0) {
          setSelectedEntityId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching entities:', err);
        setError('Failed to load GST entities');
      } finally {
        setLoading(false);
      }
    }

    fetchEntities();
  }, [supabase]);

  // Fetch CRI score when entity is selected
  useEffect(() => {
    if (!selectedEntityId) return;

    async function fetchCRIScore() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/cri/calculate?entity_id=${selectedEntityId}`
        );
        const result = await response.json();

        if (result.success && result.data) {
          setCriScore(result.data);
        } else {
          setCriScore(null);
        }
      } catch (err) {
        console.error('Error fetching CRI score:', err);
        setError('Failed to load CRI score');
      } finally {
        setLoading(false);
      }
    }

    fetchCRIScore();
  }, [selectedEntityId]);

  // Recalculate CRI score
  const handleRecalculate = async () => {
    if (!selectedEntityId) return;

    try {
      setCalculating(true);
      setError(null);

      const response = await fetch('/api/cri/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity_id: selectedEntityId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to calculate CRI score');
      }

      // Refresh the score
      setCriScore({
        id: result.data.id,
        entity_id: selectedEntityId,
        score: result.data.score,
        grade: result.data.grade,
        calculated_at: result.data.calculatedAt,
        dimension_scores: result.data.dimensionScores,
        metadata: result.data.metadata,
      });
    } catch (err) {
      console.error('Error calculating CRI:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate CRI score');
    } finally {
      setCalculating(false);
    }
  };

  if (loading && entities.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Compliance Reliability Index (CRI)
          </h1>
          <p className="text-gray-600">
            Your behavioral compliance indicator based on filing timeliness and patterns
          </p>
        </div>

        {/* Entity Selector */}
        {entities.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <label htmlFor="entity-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select GST Entity
            </label>
            <select
              id="entity-select"
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.legal_name} ({entity.gstin})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* No Data Message */}
        {!loading && !criScore && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-blue-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              No CRI Score Available
            </h3>
            <p className="text-blue-700 mb-4">
              Complete more filings to see your CRI score
            </p>
            <button
              onClick={handleRecalculate}
              disabled={calculating}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calculating ? 'Calculating...' : 'Calculate CRI'}
            </button>
          </div>
        )}

        {/* CRI Score Display */}
        {criScore && (
          <>
            {/* Score Card */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-6 text-center">
              <div className="mb-6">
                <div className="text-6xl font-bold text-gray-900 mb-2">
                  {criScore.score}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold border-2 ${getGradeColor(
                      criScore.grade
                    )}`}
                  >
                    Grade {criScore.grade}
                  </span>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                {getScoreInterpretation(criScore.score)}
              </p>

              <button
                onClick={handleRecalculate}
                disabled={calculating}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {calculating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Recalculating...
                  </span>
                ) : (
                  'Recalculate CRI'
                )}
              </button>

              <p className="text-sm text-gray-500 mt-4">
                Last calculated:{' '}
                {new Date(criScore.calculated_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Dimension Breakdown */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Dimension Breakdown
              </h2>

              <div className="space-y-6">
                <DimensionBar
                  label="Timeliness"
                  score={criScore.dimension_scores.timeliness}
                  weight="40%"
                  description="Percentage of deadlines filed on or before due date"
                />
                <DimensionBar
                  label="Consistency"
                  score={criScore.dimension_scores.consistency}
                  weight="25%"
                  description="Filing streak and pattern regularity"
                />
                <DimensionBar
                  label="Responsiveness"
                  score={criScore.dimension_scores.responsiveness}
                  weight="15%"
                  description="Average days between reminder and filing"
                />
                <DimensionBar
                  label="Verification Integrity"
                  score={criScore.dimension_scores.verificationIntegrity}
                  weight="20%"
                  description="Percentage of filings with proof provided"
                />
              </div>
            </div>

            {/* Methodology */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                How is CRI Calculated?
              </h2>
              <div className="prose text-gray-600">
                <p className="mb-3">
                  Your CRI score is calculated based on your filing behavior over the last 12 months
                  across four key dimensions:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Timeliness (40%):</strong> Measures how often you file on or before the
                    deadline
                  </li>
                  <li>
                    <strong>Consistency (25%):</strong> Evaluates your filing patterns and consecutive
                    on-time submissions
                  </li>
                  <li>
                    <strong>Responsiveness (15%):</strong> Tracks how quickly you respond to reminders
                  </li>
                  <li>
                    <strong>Verification Integrity (20%):</strong> Checks the percentage of filings
                    with supporting documentation
                  </li>
                </ul>
                <p className="mt-4">
                  <strong>Grade Mapping:</strong> A+ (95-100), A (90-94), B (80-89), C (70-79), D
                  (&lt;70)
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex gap-3">
                <svg
                  className="h-6 w-6 text-yellow-600 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900 mb-1">Disclaimer</h3>
                  <p className="text-sm text-yellow-800">
                    This is a behavioral compliance indicator based on filing timeliness and
                    patterns. It does not reflect tax correctness or legal compliance. Always
                    consult with a tax professional for compliance matters.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Dimension progress bar component
function DimensionBar({
  label,
  score,
  weight,
  description,
}: {
  label: string;
  score: number;
  weight: string;
  description: string;
}) {
  const getBarColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div>
          <span className="font-medium text-gray-900">{label}</span>
          <span className="text-sm text-gray-500 ml-2">({weight})</span>
        </div>
        <span className="font-semibold text-gray-900">{score}/100</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
