'use client';

import React, { useState, lazy, Suspense } from 'react';
import { ProfilingProvider } from './ProfilingContext';
import { ProfilingErrorBoundary } from './ProfilingErrorBoundary';

// Lazy load the view components
const RealTimeView = lazy(() => import('./RealTimeView').then(m => ({ default: m.RealTimeView })));
const HistoryBrowser = lazy(() => import('./HistoryBrowser'));

type TabView = 'live' | 'history';

interface TabButtonProps {
  id: TabView;
  label: string;
  active: boolean;
  onClick: (id: TabView) => void;
}

function TabButton({ id, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 font-medium transition-colors ${
        active
          ? 'text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}

function EnergyProfilerPanelContent() {
  const [activeView, setActiveView] = useState<TabView>('live');

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex flex-col border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Energy Profiler</h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time power and energy profiling for transformer inference
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 px-6">
          <TabButton
            id="live"
            label="Live Profiling"
            active={activeView === 'live'}
            onClick={setActiveView}
          />
          <TabButton
            id="history"
            label="History & Analysis"
            active={activeView === 'history'}
            onClick={setActiveView}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <ProfilingErrorBoundary>
          <Suspense fallback={
            <div className="p-6">
              <div className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          }>
            {activeView === 'live' && <RealTimeView />}
            {activeView === 'history' && <HistoryBrowser />}
          </Suspense>
        </ProfilingErrorBoundary>
      </div>
    </div>
  );
}

export default function EnergyProfilerPanel() {
  return (
    <ProfilingProvider>
      <EnergyProfilerPanelContent />
    </ProfilingProvider>
  );
}
