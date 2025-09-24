import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// GET: Load trading settings for a wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet_address');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Trading Settings API] Missing Supabase environment variables');
      return NextResponse.json(
        { success: false, error: 'Service configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch settings for the wallet
    const { data: settings, error } = await supabase
      .from('trading_settings')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[Trading Settings API] Error fetching settings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch trading settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: settings || null
    });
  } catch (error) {
    console.error('[Trading Settings API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Save/update trading settings for a wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      wallet_address, 
      buy_presets, 
      sell_presets, 
      slippage, 
      priority_fee 
    } = body;

    if (!wallet_address) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Trading Settings API] Missing Supabase environment variables');
      return NextResponse.json(
        { success: false, error: 'Service configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Prepare the data to upsert
    const settingsData = {
      wallet_address,
      ...(buy_presets && { buy_presets }),
      ...(sell_presets && { sell_presets }),
      ...(slippage && { slippage }),
      ...(priority_fee && { priority_fee }),
      updated_at: new Date().toISOString()
    };

    // Upsert settings (insert or update)
    const { data: settings, error } = await supabase
      .from('trading_settings')
      .upsert(settingsData, {
        onConflict: 'wallet_address',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('[Trading Settings API] Error saving settings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save trading settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('[Trading Settings API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}