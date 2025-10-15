'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit, Check, TrendingDown, Fuel } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useTradeSettings } from '@/contexts/TradeSettingsContext';
import TokenChart from '@/components/chart/TokenChart';
import TokenAvatar from '@/components/ui/TokenAvatar';
import { useWallet } from '@/providers/WalletProvider';

type Props = {
  mobile?: boolean;
};



export default function TradeSettingsPanel({ mobile = false }: Props) {
  const { settings, updateSettings } = useTradeSettings();
  const { address } = useWallet();
  
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [buyPresets, setBuyPresets] = useState(['0.1', '1', '3', '10']);
  const [sellPresets, setSellPresets] = useState(['10', '25', '50', '100']);
  const [editingValues, setEditingValues] = useState<string[]>([]);
  const loadedRef = useRef(false);
  
  // Advanced settings state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // PC version preset settings
  const [presetSlippage, setPresetSlippage] = useState('20');
  const [presetPriority, setPresetPriority] = useState('0.001');

  // Get currently selected token info from TradeSettingsContext
  const currentTokenAddress = settings.selectedToken?.contractAddress || 'So11111111111111111111111111111111111111112'; // SOL default
  const currentTokenName = settings.selectedToken?.name || 'SOL';
  
  // Save settings to backend
  const saveSettings = useCallback(async () => {
    if (!address) return;
    
    try {
      await fetch('/api/trading-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: address,
          buy_presets: buyPresets,
          sell_presets: sellPresets,
          slippage: presetSlippage,
          priority_fee: presetPriority
        })
      });
    } catch (error) {
      console.error('Failed to save trading settings:', error);
    }
  }, [address, buyPresets, sellPresets, presetSlippage, presetPriority]);

  // Load settings from backend
  const loadSettings = useCallback(async () => {
    if (!address) return;
    
    try {
      const response = await fetch(`/api/trading-settings?wallet_address=${encodeURIComponent(address)}`);
      const result = await response.json();
      
      if (result.success && result.settings) {
        setBuyPresets(result.settings.buy_presets || ['0.1', '1', '3', '10']);
        setSellPresets(result.settings.sell_presets || ['10', '25', '50', '100']);
        const slippage = result.settings.slippage || '20';
        const priorityFee = result.settings.priority_fee || '0.001';
        setPresetSlippage(slippage);
        setPresetPriority(priorityFee);
        // Update TradeSettingsContext with loaded values
        updateSettings({
          slippage: slippage,
          priorityFee: priorityFee
        });
      }
    } catch (error) {
      console.error('Failed to load trading settings:', error);
    }
  }, [address, updateSettings]);

  // Load settings when wallet connects
  useEffect(() => {
    if (address && !loadedRef.current) {
      loadedRef.current = true;
      loadSettings();
    }
  }, [address, loadSettings]);

  // Reset loaded flag when wallet changes
  useEffect(() => {
    if (!address) {
      loadedRef.current = false;
    }
  }, [address]);

  // Update TradeSettingsContext when slippage or priority changes manually
  const handleSlippageUpdate = (value: string) => {
    setPresetSlippage(value);
    updateSettings({ slippage: value });
  };

  const handlePriorityUpdate = (value: string) => {
    setPresetPriority(value);
    updateSettings({ priorityFee: value });
  };

  const presets = settings.mode === 'buy' ? buyPresets : sellPresets;
  const setPresets = settings.mode === 'buy' ? setBuyPresets : setSellPresets;

  // Change trading mode
  const handleModeChange = (mode: 'buy' | 'sell') => {
    updateSettings({ mode });
    // Save settings when mode changes
    setTimeout(() => saveSettings(), 100);
  };

  // Change quantity
  const handleQuantityChange = (quantity: string) => {
    updateSettings({ quantity });
  };

  // Change advanced settings
  const handleSlippageChange = (slippage: string) => {
    updateSettings({ slippage });
  };

  const handlePriorityFeeChange = (priorityFee: string) => {
    updateSettings({ priorityFee });
  };



  const PanelBody = mobile ? (
    // Mobile version
    <div className="flex flex-col py-2 px-4" style={{ color: 'white', boxShadow: 'none' }}>
      <div className="flex flex-col gap-2">
        {/* Edit button and BUY/SELL toggle */}
        <div className="flex items-center justify-between w-full">
          <Button
            size="sm"
            variant="neutral"
            onClick={() => {
              if (isEditingPresets) {
                const validValues = editingValues
                  .slice(0, 4)
                  .map(val => val.trim() || '0')
                  .filter(val => val !== '0' && val !== '');
                
                while (validValues.length < 4) {
                  validValues.push((validValues.length + 1).toString());
                }
                
                setPresets(validValues.slice(0, 4));
                setEditingValues([]);
                setIsEditingPresets(false);
                // Save settings after editing presets
                setTimeout(() => saveSettings(), 100);
              } else {
                const paddedPresets = [...presets].slice(0, 4);
                while (paddedPresets.length < 4) {
                  paddedPresets.push('');
                }
                setEditingValues(paddedPresets);
                setIsEditingPresets(true);
              }
            }}
            className="px-3 font-medium text-sm text-white border"
            style={{ backgroundColor: 'oklch(0.2393 0 0)', borderRadius: '0', borderColor: 'rgb(0, 0, 0)', height: '25px', boxShadow: '2px 2px 0px 0px rgba(0,0,0,1) !important' }}
          >
            {isEditingPresets ? <Check className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
            {isEditingPresets ? ' Save' : ' Edit'}
          </Button>
          
          <div className="flex w-full ml-1 gap-1">
            <Button 
              variant={settings.mode === 'buy' ? 'default' : 'neutral'}
              className={`flex-1 font-semibold transition-all text-sm border ${
                settings.mode === 'buy' 
                  ? 'text-white' 
                  : 'text-white hover:text-gray-300'
              }`}
              style={{ 
                backgroundColor: settings.mode === 'buy' ? '#22c55e' : 'oklch(0.2393 0 0)',
                borderRadius: '0',
                borderColor: 'rgb(0, 0, 0)',
                height: '25px',
                boxShadow: '2px 2px 0px 0px rgba(0,0,0,1) !important'
              }}
              onClick={() => handleModeChange('buy')}
            >
              BUY
            </Button>
            <Button 
              variant={settings.mode === 'sell' ? 'default' : 'neutral'}
              className={`flex-1 font-semibold transition-all text-sm border ${
                settings.mode === 'sell' 
                  ? 'text-white' 
                  : 'text-white hover:text-gray-300'
              }`}
              style={{ 
                backgroundColor: settings.mode === 'sell' ? '#ef4444' : 'oklch(0.2393 0 0)',
                borderRadius: '0',
                borderColor: 'rgb(0, 0, 0)',
                height: '25px',
                boxShadow: '2px 2px 0px 0px rgba(0,0,0,1) !important'
              }}
              onClick={() => handleModeChange('sell')}
            >
              SELL
            </Button>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="w-full">
          {isEditingPresets ? (
            <div className="grid grid-cols-4 gap-1 w-full">
              {[0, 1, 2, 3].map((index) => (
                <Input
                  key={index}
                  value={editingValues[index] || ''}
                  onChange={(e) => {
                    const newValues = [...editingValues];
                    while (newValues.length <= index) {
                      newValues.push('');
                    }
                    newValues[index] = e.target.value;
                    setEditingValues(newValues);
                  }}
                  className="text-center border font-medium text-sm text-white placeholder-gray-400"
                  style={{
                    backgroundColor: 'oklch(0.2393 0 0)',
                    borderColor: 'rgb(0, 0, 0)',
                    borderRadius: '0',
                    boxShadow: '2px 2px 0px 0px rgba(0,0,0,1) !important',
                    outline: 'none',
                    height: '25px'
                  }}
                  placeholder={`${index + 1}`}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1 w-full">
              {presets.map((preset) => (
                <Badge 
                  key={preset}
                  variant={settings.quantity === preset ? 'default' : 'neutral'}
                  className={`cursor-pointer px-2 py-2 text-center flex items-center justify-center w-full font-semibold border transition-all text-sm text-white ${
                    settings.quantity === preset 
                      ? ''
                      : 'hover:border-gray-400'
                  }`}
                  style={{
                    backgroundColor: settings.quantity === preset 
                      ? settings.mode === 'buy' 
                        ? '#22c55e' 
                        : '#ef4444'
                      : 'oklch(0.2393 0 0)',
                    borderColor: settings.quantity === preset 
                      ? settings.mode === 'buy' 
                        ? '#22c55e' 
                        : '#ef4444'
                      : 'rgb(0, 0, 0)',
                    borderRadius: '0',
                    height: '25px',
                    boxShadow: '2px 2px 0px 0px rgba(0,0,0,1) !important'
                  }}
                  onClick={() => handleQuantityChange(preset)}
                >
                  {settings.mode === 'sell' ? `${preset}%` : preset}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Quantity input */}
        <div className="w-full">
          <Input 
            placeholder={settings.mode === 'buy' ? 'Enter SOL amount' : 'Enter percentage (%)'}
            value={settings.quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="w-full text-base font-medium border text-white placeholder-gray-400"
            style={{
              backgroundColor: 'oklch(0.2393 0 0)',
              borderColor: 'rgb(0, 0, 0)',
              borderRadius: '0',
              boxShadow: '2px 2px 0px 0px rgba(0,0,0,1) !important',
              outline: 'none',
              height: '25px'
            }}
          />
        </div>

        {/* Advanced settings */}
        <Drawer open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <DrawerTrigger asChild>
            <div className="w-full border cursor-pointer transition-colors p-2 flex items-center"
                 style={{
                   backgroundColor: 'oklch(0.2393 0 0)',
                   borderColor: 'rgb(0, 0, 0)',
                   borderRadius: '0',
                   boxShadow: 'none',
                   outline: 'none',
                   height: '25px'
                 }}>
              <div className="flex items-center justify-between text-sm gap-2 w-full">
                <div className="flex items-center gap-1 flex-1 min-w-0 justify-center">
                  <TrendingDown className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-sm truncate text-white">{settings.slippage}%</span>
                </div>
                <div className="flex items-center gap-1 flex-1 min-w-0 justify-center">
                  <Fuel className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span className="font-medium text-sm truncate text-white">{settings.priorityFee}</span>
                </div>
              </div>
            </div>
          </DrawerTrigger>
          
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-white">Advanced Settings</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-white">Slippage (%)</label>
                <Input
                  value={settings.slippage}
                  onChange={(e) => {
                    handleSlippageChange(e.target.value);
                    handleSlippageUpdate(e.target.value);
                  }}
                  onBlur={() => saveSettings()}
                  placeholder="1"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-white">Priority Fee</label>
                <Input
                  value={settings.priorityFee}
                  onChange={(e) => {
                    handlePriorityFeeChange(e.target.value);
                    handlePriorityUpdate(e.target.value);
                  }}
                  onBlur={() => saveSettings()}
                  placeholder="0.001"
                  className="w-full"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => setIsAdvancedOpen(false)}
              >
                Complete Settings
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  ) : (
    // PC version
    <div className="flex flex-col h-full py-6 justify-between" style={{ paddingLeft: '24px', paddingRight: '24px', backgroundColor: 'oklch(0.2393 0 0)', color: 'white' }}>
      {/* Top trading section */}
      <div className="space-y-4">
        {/* BUY/SELL tabs */}
        <div className="flex w-full gap-3">
          <Button
            variant={settings.mode === 'buy' ? 'default' : 'neutral'}
            className={`flex-1 h-10 font-semibold transition-all ${
                settings.mode === 'buy'
                  ? 'text-white'
                  : 'text-white hover:text-gray-300'
              }`}
              style={{ 
                backgroundColor: settings.mode === 'buy' ? '#22c55e' : 'oklch(0.2393 0 0)',
                borderRadius: '0',
                borderColor: 'rgb(0, 0, 0)'
              }}
            onClick={() => handleModeChange('buy')}
          >
            Buy
          </Button>
          <Button
            variant={settings.mode === 'sell' ? 'default' : 'neutral'}
            className={`flex-1 h-10 font-semibold transition-all ${
                settings.mode === 'sell'
                  ? 'text-white'
                  : 'text-white hover:text-gray-300'
              }`}
              style={{ 
                backgroundColor: settings.mode === 'sell' ? '#ef4444' : 'oklch(0.2393 0 0)',
                borderRadius: '0',
                borderColor: 'rgb(0, 0, 0)'
              }}
            onClick={() => handleModeChange('sell')}
          >
            Sell
          </Button>
        </div>

        {/* AMOUNT input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Amount</label>
          <div className="relative">
            <Input
                value={settings.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder={settings.mode === 'buy' ? 'Enter SOL amount' : 'Enter percentage (%)'}
                className="w-full h-12 text-lg font-medium border-2 focus:ring-2 focus:ring-blue-500 pr-14 text-white placeholder-gray-400"
                style={{ backgroundColor: 'oklch(0.2393 0 0)', borderColor: 'rgb(0, 0, 0)', borderRadius: '0' }}
              />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {settings.mode === 'buy' ? (
                <TokenAvatar 
                  key={`buy-sol-${settings.mode}`}
                  tokenAddress="So11111111111111111111111111111111111111112"
                  tokenName="SOL"
                  size="sm"
                />
              ) : (
                <TokenAvatar
                  key={`sell-${currentTokenAddress}-${settings.mode}`}
                  tokenAddress={currentTokenAddress}
                  tokenName={currentTokenName}
                  size="sm"
                />
              )}
            </div>
          </div>

        </div>

        {/* Preset buttons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-white">Quick Amounts</label>
            <Button
              variant="neutral"
              size="sm"
              className="h-8 w-8 p-0 text-white"
              style={{ backgroundColor: 'oklch(0.2393 0 0)', borderRadius: '0', borderColor: 'rgb(0, 0, 0)' }}
              onClick={() => {
                if (isEditingPresets) {
                  const validValues = editingValues
                    .slice(0, 4)
                    .map(val => val.trim() || '0')
                    .filter(val => val !== '0' && val !== '');
                  
                  while (validValues.length < 4) {
                    validValues.push((validValues.length + 1).toString());
                  }
                  
                  setPresets(validValues.slice(0, 4));
                  setEditingValues([]);
                  setIsEditingPresets(false);
                  // Save settings after editing presets
                  setTimeout(() => saveSettings(), 100);
                } else {
                  const paddedPresets = [...presets].slice(0, 4);
                  while (paddedPresets.length < 4) {
                    paddedPresets.push('');
                  }
                  setEditingValues(paddedPresets);
                  setIsEditingPresets(true);
                }
              }}
            >
              {isEditingPresets ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {isEditingPresets ? (
              [0, 1, 2, 3].map((index) => (
                <Input
                  key={index}
                  value={editingValues[index] || ''}
                  onChange={(e) => {
                    const newValues = [...editingValues];
                    while (newValues.length <= index) {
                      newValues.push('');
                    }
                    newValues[index] = e.target.value;
                    setEditingValues(newValues);
                  }}
                  className="text-center h-8 border-2 text-white placeholder-gray-400"
                  style={{
                    backgroundColor: 'oklch(0.2393 0 0)',
                    borderColor: 'rgb(0, 0, 0)',
                    borderRadius: '0',
                    boxShadow: 'none',
                    outline: 'none'
                  }}
                  placeholder={`${index + 1}`}
                />
              ))
            ) : (
              presets.map((preset) => (
                <Button
                  key={preset}
                  variant={settings.quantity === preset ? 'default' : 'neutral'}
                  className={`h-8 font-semibold border-2 transition-all text-white ${
                    settings.quantity === preset 
                      ? ''
                      : 'hover:border-gray-400'
                  }`}
                  style={{
                    backgroundColor: settings.quantity === preset 
                      ? settings.mode === 'buy' 
                        ? '#22c55e' 
                        : '#ef4444'
                      : 'oklch(0.2393 0 0)',
                    borderColor: settings.quantity === preset 
                      ? settings.mode === 'buy' 
                        ? '#22c55e' 
                        : '#ef4444'
                      : 'rgb(0, 0, 0)',
                    borderRadius: '0'
                  }}
                  onClick={() => handleQuantityChange(preset)}
                >
                  {settings.mode === 'sell' ? `${preset}%` : preset}
                </Button>
              ))
            )}
          </div>
        </div>

        {/* Current settings display */}
        <div className="border-2 p-2" style={{ backgroundColor: 'oklch(0.2393 0 0)', borderColor: 'rgb(0, 0, 0)', borderRadius: '0' }}>
          <div className="flex items-center justify-between text-xs gap-1">
            <div className="flex items-center gap-1 flex-1 min-w-0 justify-center">
              <TrendingDown className="h-3 w-3 text-blue-500 flex-shrink-0" />
              <span className="font-medium text-xs truncate">{presetSlippage}%</span>
            </div>
            <div className="flex items-center gap-1 flex-1 min-w-0 justify-center">
              <Fuel className="h-3 w-3 text-orange-500 flex-shrink-0" />
              <span className="font-medium text-xs truncate">{presetPriority}</span>
            </div>
          </div>
        </div>

        {/* Token price chart by chat room */}
        <div className="border-2 border-black p-4 w-full" style={{ width: '264px', height: '256px', backgroundColor: 'oklch(0.2393 0 0)' }}>
          {/* Token name */}
          <div className="mb-4">
            <span className="text-sm font-medium text-white">
              {currentTokenName} ({currentTokenAddress ? `${currentTokenAddress.slice(0, 4)}...${currentTokenAddress.slice(-4)}` : 'N/A'})
            </span>
          </div>
          
          {/* Chart */}
          <div className="h-28 w-full">
            <TokenChart 
              tokenAddress={currentTokenAddress}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Bottom settings input section */}
      <div className="space-y-4 pt-6 border-t border-gray-600">
        {/* Settings input */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-white flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              SLIPPAGE
            </label>
            <Input
              value={presetSlippage}
              onChange={(e) => handleSlippageUpdate(e.target.value)}
              onBlur={() => saveSettings()}
              className="text-center h-8 text-lg font-semibold border-2 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
              style={{ backgroundColor: 'oklch(0.2393 0 0)', borderColor: 'rgb(0, 0, 0)', borderRadius: '0' }}
              placeholder="50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-white flex items-center gap-1">
              <span>⛽</span>
              PRIORITY
            </label>
            <Input
              value={presetPriority}
              onChange={(e) => handlePriorityUpdate(e.target.value)}
              onBlur={() => saveSettings()}
              className="text-center h-8 text-lg font-semibold border-2 focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-400"
              style={{ backgroundColor: 'oklch(0.2393 0 0)', borderColor: 'rgb(0, 0, 0)', borderRadius: '0' }}
              placeholder="105"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return mobile ? (
    <div className="mobile-trade-drawer">{PanelBody}</div>
  ) : (
    <aside className="desktop-trade-panel">{PanelBody}</aside>
  );
} 