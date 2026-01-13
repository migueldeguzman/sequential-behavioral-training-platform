'use client';

import React, { useState, useMemo } from 'react';
import { ProfilingRun, ComponentMetrics } from '@/types';
import { MetricSelector, MetricType } from './MetricSelector';
import { PipelineTimeline } from './charts/PipelineTimeline';
import TokenSlider from './TokenSlider';
import HeatmapChart from './charts/HeatmapChart';
import TreemapChart from './charts/TreemapChart';
import SankeyChart from './charts/SankeyChart';
import DeepDrilldown from './DeepDrilldown';

interface AnalysisViewProps {
  run: ProfilingRun;
}

type VisualizationType = 'heatmap' | 'treemap' | 'sankey';

const AnalysisView: React.FC<AnalysisViewProps> = ({ run }) => {
  // State management
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('time');
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number>(0);
  const [selectedVisualization, setSelectedVisualization] = useState<VisualizationType>('heatmap');
  const [selectedComponent, setSelectedComponent] = useState<ComponentMetrics | null>(null);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);

  // Get current token
  const currentToken = run.tokens?.[selectedTokenIndex];

  // Extract heatmap data based on selected metric and token
  const heatmapData = useMemo(() => {
    if (!currentToken?.layers) return { data: [], xLabels: [], yLabels: [] };

    const componentTypes = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj', 'input_layernorm', 'post_attention_layernorm'];
    const layers = currentToken.layers;
    const numLayers = layers.length;

    // Create 2D array: layers x components
    const data: number[][] = [];
    const yLabels: string[] = [];

    for (let i = 0; i < numLayers; i++) {
      const layer = layers[i];
      const row: number[] = [];
      yLabels.push(`Layer ${i}`);

      for (const compType of componentTypes) {
        const component = layer.components?.find(c => c.component_name === compType);
        let value = 0;

        if (component) {
          switch (selectedMetric) {
            case 'time':
              value = component.duration_ms || 0;
              break;
            case 'activation_mean':
              value = component.activation_mean || 0;
              break;
            case 'activation_max':
              value = component.activation_max || 0;
              break;
            case 'sparsity':
              value = component.sparsity || 0;
              break;
            case 'attention_entropy':
              value = component.deep_operations?.[0]?.attention_entropy || 0;
              break;
            default:
              value = component.duration_ms || 0;
          }
        }

        row.push(value);
      }

      data.push(row);
    }

    const xLabels = componentTypes.map(name =>
      name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );

    return { data, xLabels, yLabels };
  }, [currentToken, selectedMetric]);

  // Extract treemap data
  const treemapData = useMemo(() => {
    if (!currentToken?.layers) return null;

    const children = currentToken.layers.map((layer, layerIdx) => {
      const layerChildren = layer.components?.map(comp => ({
        name: comp.component_name,
        value: comp.duration_ms || 0,
        color: comp.component_name.includes('attention') ? '#3b82f6' : '#10b981'
      })) || [];

      return {
        name: `Layer ${layerIdx}`,
        children: layerChildren
      };
    });

    return {
      name: 'Model',
      children
    };
  }, [currentToken, selectedMetric]);

  // Extract sankey data
  const sankeyData = useMemo(() => {
    if (!currentToken?.layers) return { nodes: [], links: [] };

    const nodes: { id: string; name: string; category?: 'input' | 'layer' | 'output' }[] = [
      { id: 'input', name: 'Input', category: 'input' }
    ];
    const links: { source: string; target: string; value: number }[] = [];

    currentToken.layers.forEach((layer, idx) => {
      const nodeId = `layer-${idx}`;
      nodes.push({ id: nodeId, name: `Layer ${idx}`, category: 'layer' });

      // Link from input or previous layer
      const sourceId = idx === 0 ? 'input' : `layer-${idx - 1}`;
      const value = layer.components?.reduce((sum, comp) =>
        sum + (comp.duration_ms || 0), 0
      ) || 0;

      links.push({ source: sourceId, target: nodeId, value });
    });

    nodes.push({ id: 'output', name: 'Output', category: 'output' });
    const lastLayerIdx = currentToken.layers.length - 1;
    const lastLayerValue = currentToken.layers[lastLayerIdx].components?.reduce((sum, comp) =>
      sum + (comp.duration_ms || 0), 0
    ) || 0;
    links.push({ source: `layer-${lastLayerIdx}`, target: 'output', value: lastLayerValue });

    return { nodes, links };
  }, [currentToken, selectedMetric]);

  // Handle heatmap cell click
  const handleHeatmapClick = (x: number, y: number) => {
    if (!currentToken?.layers) return;

    const layer = currentToken.layers[y];
    const componentTypes = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj', 'input_layernorm', 'post_attention_layernorm'];
    const componentName = componentTypes[x];

    const component = layer.components?.find(c => c.component_name === componentName);
    if (component) {
      setSelectedComponent(component);
      setSelectedLayerIndex(y);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Metric Selector */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <MetricSelector
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          isDeepProfiling={run.profiling_depth === 'deep'}
        />
      </div>

      {/* Pipeline Timeline Overview */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Pipeline Overview
        </h3>
        <PipelineTimeline
          sections={run.pipeline_sections || []}
        />
      </div>

      {/* Token Slider */}
      {run.tokens && run.tokens.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <TokenSlider
            tokens={run.tokens}
            currentTokenIndex={selectedTokenIndex}
            onTokenChange={setSelectedTokenIndex}
          />
        </div>
      )}

      {/* Visualization Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 pt-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedVisualization('heatmap')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedVisualization === 'heatmap'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Heatmap
          </button>
          <button
            onClick={() => setSelectedVisualization('treemap')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedVisualization === 'treemap'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Treemap
          </button>
          <button
            onClick={() => setSelectedVisualization('sankey')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedVisualization === 'sankey'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Sankey
          </button>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 overflow-auto p-4">
        {selectedVisualization === 'heatmap' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Layer × Component Heatmap
            </h3>
            <HeatmapChart
              data={heatmapData.data}
              xLabels={heatmapData.xLabels}
              yLabels={heatmapData.yLabels}
              colorScale={selectedMetric === 'sparsity' ?
                { min: '#f0fdfa', max: '#134e4a' } :
                { min: '#fef2f2', max: '#7f1d1d' }
              }
              onCellClick={handleHeatmapClick}
            />
          </div>
        )}

        {selectedVisualization === 'treemap' && treemapData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Hierarchical Treemap
            </h3>
            <TreemapChart
              data={treemapData}
            />
          </div>
        )}

        {selectedVisualization === 'sankey' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Energy Flow Diagram
            </h3>
            <SankeyChart
              nodes={sankeyData.nodes}
              links={sankeyData.links}
            />
          </div>
        )}
      </div>

      {/* Deep Drilldown Modal */}
      {selectedComponent && (
        <DeepDrilldown
          componentMetrics={selectedComponent}
          deepOperations={selectedComponent.deep_operations || []}
          layerIndex={selectedLayerIndex}
          onClose={() => {
            setSelectedComponent(null);
          }}
        />
      )}
    </div>
  );
};

export default AnalysisView;
