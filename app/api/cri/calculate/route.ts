/**
 * API Route: /api/cri/calculate
 * Calculates CRI score for a given entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { aggregateDeadlineMetrics, validateEntityOwnership } from '@/lib/cri/aggregator';
import { calculateCRIScore } from '@/lib/cri/calculator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const { entity_id } = body;

    if (!entity_id) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      );
    }

    // Validate entity ownership
    const isOwner = await validateEntityOwnership(entity_id, userId, supabase);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Entity not found or access denied' },
        { status: 403 }
      );
    }

    // Aggregate deadline metrics
    const metrics = await aggregateDeadlineMetrics(entity_id, supabase);

    // Calculate CRI score
    const criResult = calculateCRIScore(metrics);

    // Insert/update CRI score in database
    const { data: existingScore } = await supabase
      .from('cri_scores')
      .select('id')
      .eq('entity_id', entity_id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    let savedScore;

    if (existingScore) {
      // Update existing record
      const { data, error: updateError } = await supabase
        .from('cri_scores')
        .update({
          score: criResult.score,
          grade: criResult.grade,
          calculated_at: new Date().toISOString(),
          dimension_scores: criResult.dimensionScores,
          metadata: {
            ...criResult.metadata,
            metrics,
          },
        })
        .eq('id', existingScore.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update CRI score: ${updateError.message}`);
      }

      savedScore = data;
    } else {
      // Insert new record
      const { data, error: insertError } = await supabase
        .from('cri_scores')
        .insert({
          entity_id,
          score: criResult.score,
          grade: criResult.grade,
          calculated_at: new Date().toISOString(),
          dimension_scores: criResult.dimensionScores,
          metadata: {
            ...criResult.metadata,
            metrics,
          },
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to insert CRI score: ${insertError.message}`);
      }

      savedScore = data;
    }

    // Return the calculated CRI score
    return NextResponse.json({
      success: true,
      data: {
        score: criResult.score,
        grade: criResult.grade,
        dimensionScores: criResult.dimensionScores,
        metadata: criResult.metadata,
        id: savedScore.id,
        calculatedAt: savedScore.calculated_at,
      },
    });
  } catch (error) {
    console.error('CRI calculation error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get entity_id from query params
    const { searchParams } = new URL(request.url);
    const entity_id = searchParams.get('entity_id');

    if (!entity_id) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      );
    }

    // Validate entity ownership
    const isOwner = await validateEntityOwnership(entity_id, userId, supabase);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Entity not found or access denied' },
        { status: 403 }
      );
    }

    // Fetch latest CRI score
    const { data: criScore, error } = await supabase
      .from('cri_scores')
      .select('*')
      .eq('entity_id', entity_id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      throw new Error(`Failed to fetch CRI score: ${error.message}`);
    }

    if (!criScore) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No CRI score found for this entity',
      });
    }

    return NextResponse.json({
      success: true,
      data: criScore,
    });
  } catch (error) {
    console.error('CRI fetch error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
