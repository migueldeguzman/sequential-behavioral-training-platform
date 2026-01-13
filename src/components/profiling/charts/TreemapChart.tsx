'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface TreemapNode {
  name: string
  value?: number
  children?: TreemapNode[]
  color?: string
  category?: string
}

interface TreemapRectNode extends d3.HierarchyRectangularNode<TreemapNode> {
  data: TreemapNode
}

interface TreemapChartProps {
  data: TreemapNode
  metric?: 'time' | 'energy' | 'power'
  width?: number
  height?: number
  onNodeClick?: (node: TreemapNode) => void
  colorScale?: string[]
}

export default function TreemapChart({
  data,
  metric = 'energy',
  width = 800,
  height = 600,
  onNodeClick,
  colorScale = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']
}: TreemapChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [path, setPath] = useState<TreemapNode[]>([data])
  const [currentRoot, setCurrentRoot] = useState<TreemapNode>(data)

  useEffect(() => {
    if (!svgRef.current || !data) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 10, left: 10 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom - 40 // Reserve space for breadcrumbs

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top + 40})`)

    // Create color scale
    const color = d3.scaleOrdinal<string>()
      .domain(['attention', 'mlp', 'layernorm', 'embedding', 'other'])
      .range(colorScale)

    // Create treemap layout
    const treemap = d3.treemap<TreemapNode>()
      .size([chartWidth, chartHeight])
      .padding(2)
      .round(true)

    // Create hierarchy
    const root = d3.hierarchy(currentRoot)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    treemap(root)

    // Calculate total value for percentages
    const total = root.value || 1

    // Create cells
    const cell = g
      .selectAll('g')
      .data(root.leaves() as TreemapRectNode[])
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .style('cursor', d => d.data.children ? 'pointer' : 'default')

    // Add rectangles
    cell
      .append('rect')
      .attr('id', (_, i) => `rect-${i}`)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => {
        const category = d.data.category || 'other'
        return color(category)
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('opacity', 0.8)
      .on('mouseover', function() {
        d3.select(this).style('opacity', 1)
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.8)
      })
      .on('click', function(event, d) {
        event.stopPropagation()
        if (d.data.children) {
          setCurrentRoot(d.data)
          setPath(prev => [...prev, d.data])
        }
        if (onNodeClick) {
          onNodeClick(d.data)
        }
      })

    // Add labels for large enough cells
    cell
      .append('text')
      .attr('x', 4)
      .attr('y', 16)
      .text(d => {
        const width = d.x1 - d.x0
        const name = d.data.name
        if (width < 60) return ''
        return name.length > Math.floor(width / 8)
          ? name.substring(0, Math.floor(width / 8)) + '...'
          : name
      })
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#fff')
      .style('pointer-events', 'none')

    // Add percentage labels
    cell
      .append('text')
      .attr('x', 4)
      .attr('y', 32)
      .text(d => {
        const width = d.x1 - d.x0
        const height = d.y1 - d.y0
        if (width < 60 || height < 40) return ''
        const percentage = ((d.value || 0) / total * 100).toFixed(1)
        return `${percentage}%`
      })
      .attr('font-size', 10)
      .attr('fill', '#fff')
      .style('opacity', 0.9)
      .style('pointer-events', 'none')

    // Add value labels for large cells
    cell
      .append('text')
      .attr('x', 4)
      .attr('y', 48)
      .text(d => {
        const width = d.x1 - d.x0
        const height = d.y1 - d.y0
        if (width < 80 || height < 60) return ''
        const value = d.value || 0
        if (metric === 'time') return `${value.toFixed(1)} ms`
        if (metric === 'energy') return `${value.toFixed(1)} mJ`
        if (metric === 'power') return `${value.toFixed(1)} mW`
        return value.toFixed(1)
      })
      .attr('font-size', 9)
      .attr('fill', '#fff')
      .style('opacity', 0.8)
      .style('pointer-events', 'none')

    // Add title
    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 25)
      .text(`Energy Distribution by Component (${getMetricLabel(metric)})`)
      .attr('font-size', 14)
      .attr('font-weight', 600)
      .attr('fill', '#1f2937')

  }, [currentRoot, data, width, height, metric, onNodeClick, colorScale])

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'time': return 'milliseconds'
      case 'energy': return 'millijoules'
      case 'power': return 'milliwatts'
      default: return ''
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    const newPath = path.slice(0, index + 1)
    setPath(newPath)
    setCurrentRoot(newPath[newPath.length - 1])
  }

  return (
    <div className="treemap-chart">
      {/* Breadcrumb navigation */}
      <div className="mb-2 flex items-center space-x-2 text-sm">
        {path.map((node, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="text-gray-400">/</span>
            )}
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={`px-2 py-1 rounded hover:bg-gray-100 ${
                index === path.length - 1
                  ? 'font-semibold text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={index === path.length - 1}
            >
              {node.name}
            </button>
          </React.Fragment>
        ))}
      </div>

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
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#2563eb' }}></div>
          <span>Attention</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
          <span>MLP</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#60a5fa' }}></div>
          <span>LayerNorm</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#93c5fd' }}></div>
          <span>Embedding</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dbeafe' }}></div>
          <span>Other</span>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500">
        Click on a cell to zoom into its children. Use breadcrumbs to navigate back.
      </div>
    </div>
  )
}
