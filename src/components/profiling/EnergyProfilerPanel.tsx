'use client';

import React, { useState } from 'react';
import { ProfilingProvider } from './ProfilingContext';

type TabView = 'live' | 'analysis' | 'history';

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
            label="Live"
            active={activeView === 'live'}
            onClick={setActiveView}
          />
          <TabButton
            id="analysis"
            label="Analysis"
            active={activeView === 'analysis'}
            onClick={setActiveView}
          />
          <TabButton
            id="history"
            label="History"
            active={activeView === 'history'}
            onClick={setActiveView}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {activeView === 'live' && (
          <div className="p-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Live profiling view - Coming soon</p>
              <p className="text-sm text-gray-500 mt-2">
                Real-time power monitoring, token generation stream, and layer heatmaps will appear here.
              </p>
            </div>
          </div>
        )}

        {activeView === 'analysis' && (
          <div className="p-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Analysis view - Coming soon</p>
              <p className="text-sm text-gray-500 mt-2">
                Post-inference analysis with heatmaps, treemaps, and detailed metrics will appear here.
              </p>
            </div>
          </div>
        )}

        {activeView === 'history' && (
          <div className="p-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">History browser - Coming soon</p>
              <p className="text-sm text-gray-500 mt-2">
                Browse past profiling runs, compare results, and export data will be available here.
              </p>
            </div>
          </div>
        )}
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
