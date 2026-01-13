'use client'

import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, SankeyGraph, SankeyNode as D3SankeyNode } from 'd3-sankey'

interface SankeyNodeData {
  id: string
  name: string
  category?: 'input' | 'layer' | 'attention' | 'mlp' | 'output'
}

interface SankeyLinkData {
  source: string
  target: string
  value: number
  label?: string
}

type ProcessedSankeyNode = D3SankeyNode<SankeyNodeData, SankeyLinkData>

interface SankeyChartProps {
  nodes: SankeyNodeData[]
  links: SankeyLinkData[]
  metric?: 'energy' | 'time' | 'power'
  width?: number
  height?: number
  onNodeClick?: (node: SankeyNodeData) => void
  onLinkClick?: (link: SankeyLinkData) => void
}

export default function SankeyChart({
  nodes,
  links,
  metric = 'energy',
  width = 900,
  height = 600,
  onNodeClick,
  onLinkClick
}: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !nodes.length || !links.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 40, right: 160, bottom: 20, left: 160 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create color scale for different categories
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['input', 'layer', 'attention', 'mlp', 'output'])
      .range(['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'])

    // Create sankey layout
    const sankeyLayout = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId((d) => d.id)
      .nodeWidth(20)
      .nodePadding(10)
      .extent([[0, 0], [chartWidth, chartHeight]])

    // Create the sankey graph - d3-sankey will handle ID resolution
    const graph: SankeyGraph<SankeyNodeData, SankeyLinkData> = {
      nodes: nodes.map(node => ({ ...node })),
      links: links.map(link => ({ ...link }))
    }

    sankeyLayout(graph)

    // Create gradient for links
    const defs = svg.append('defs')

    graph.links.forEach((link, i) => {
      const source = link.source as ProcessedSankeyNode
      const target = link.target as ProcessedSankeyNode

      const gradient = defs
        .append('linearGradient')
        .attr('id', `gradient-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', source.x1 || 0)
        .attr('x2', target.x0 || 0)

      gradient
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colorScale(source.category || 'layer'))

      gradient
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colorScale(target.category || 'layer'))
    })

    // Draw links
    const linkGroup = g
      .append('g')
      .attr('class', 'links')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.4)

    linkGroup
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (_, i) => `url(#gradient-${i})`)
      .attr('stroke-width', (d) => Math.max(1, d.width || 1))
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 0.8)

        const source = d.source as ProcessedSankeyNode
        const target = d.target as ProcessedSankeyNode

        // Show tooltip
        const tooltip = svg.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${event.offsetX},${event.offsetY - 10})`)

        tooltip
          .append('rect')
          .attr('fill', '#1f2937')
          .attr('rx', 4)
          .attr('width', 160)
          .attr('height', 60)

        tooltip
          .append('text')
          .attr('x', 8)
          .attr('y', 20)
          .attr('fill', '#fff')
          .attr('font-size', 12)
          .text(d.label || `${source.name} → ${target.name}`)

        tooltip
          .append('text')
          .attr('x', 8)
          .attr('y', 40)
          .attr('fill', '#9ca3af')
          .attr('font-size', 11)
          .text(`${getMetricLabel(metric)}: ${formatValue(d.value || 0, metric)}`)
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke-opacity', 0.4)
        svg.selectAll('.tooltip').remove()
      })
      .on('click', function(event, d) {
        event.stopPropagation()
        if (onLinkClick) {
          const source = d.source as ProcessedSankeyNode
          const target = d.target as ProcessedSankeyNode
          const originalLink = links.find(link =>
            link.source === source.id && link.target === target.id
          )
          if (originalLink) {
            onLinkClick(originalLink)
          }
        }
      })

    // Draw nodes
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')

    const node = nodeGroup
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        event.stopPropagation()
        if (onNodeClick) {
          onNodeClick(d)
        }
      })

    // Draw node rectangles
    node
      .append('rect')
      .attr('x', (d) => d.x0 || 0)
      .attr('y', (d) => d.y0 || 0)
      .attr('height', (d) => Math.max(1, (d.y1 || 0) - (d.y0 || 0)))
      .attr('width', (d) => (d.x1 || 0) - (d.x0 || 0))
      .attr('fill', (d) => colorScale(d.category || 'layer'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('opacity', 0.9)
      .on('mouseover', function() {
        d3.select(this).style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.9)
      })

    // Add node labels
    node
      .append('text')
      .attr('x', (d) => (d.x0 || 0) < chartWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', (d) => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.x0 || 0) < chartWidth / 2 ? 'start' : 'end')
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', '#1f2937')
      .text((d) => d.name)
      .style('pointer-events', 'none')

    // Add node value labels
    node
      .append('text')
      .attr('x', (d) => (d.x0 || 0) < chartWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', (d) => ((d.y1 || 0) + (d.y0 || 0)) / 2 + 14)
      .attr('text-anchor', (d) => (d.x0 || 0) < chartWidth / 2 ? 'start' : 'end')
      .attr('font-size', 9)
      .attr('fill', '#6b7280')
      .text((d) => formatValue(d.value || 0, metric))
      .style('pointer-events', 'none')

    // Add title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .text(`Energy Flow Through Model (${getMetricLabel(metric)})`)
      .attr('font-size', 14)
      .attr('font-weight', 600)
      .attr('fill', '#1f2937')

  }, [nodes, links, metric, width, height, onNodeClick, onLinkClick])

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'time': return 'Time'
      case 'energy': return 'Energy'
      case 'power': return 'Power'
      default: return ''
    }
  }

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'time': return `${value.toFixed(1)} ms`
      case 'energy': return `${value.toFixed(1)} mJ`
      case 'power': return `${value.toFixed(1)} mW`
      default: return value.toFixed(1)
    }
  }

  return (
    <div className="sankey-chart">
      {/* SVG Container */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded-lg bg-white"
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6366f1' }}></div>
          <span>Input</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8b5cf6' }}></div>
          <span>Layer</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ec4899' }}></div>
          <span>Attention</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>MLP</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
          <span>Output</span>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500">
        Hover over nodes and links to see energy flow details. Click to drill down.
      </div>
    </div>
  )
}
