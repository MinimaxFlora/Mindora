/*
 * D3 force layout is an imperative external layout engine. This component
 * intentionally copies its computed positions into React state after measuring
 * the container, and refits the viewport when a new layout arrives.
 */
/* eslint-disable react-hooks/set-state-in-effect */
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { Focus, Minus, Plus } from 'lucide-react'
import * as React from 'react'

import { useI18n } from '@/i18n/use-i18n'
import type { GraphNode, KnowledgeGraph } from '@/lib/graph'
import { folderDisplayPath } from '@/lib/tree'
import { cn } from '@/lib/utils'
import type { Folder } from '@/db/types'

interface SimNode extends SimulationNodeDatum, GraphNode {
  color: string
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string
}

interface PositionedNode extends GraphNode {
  x: number
  y: number
  color: string
}

interface GraphCanvasProps {
  graph: KnowledgeGraph
  folders: Folder[]
  query: string
  onOpen: (id: string) => void
  className?: string
}

const PALETTE = ['#2f6b5a', '#8a6a3f', '#5d648c', '#8a5b69', '#5f7a48', '#8b7c3f', '#4f6f78', '#6d5a8a']

function colorForFolder(folderId: string | null): string {
  if (!folderId) return '#7b7d72'
  let hash = 0
  for (let index = 0; index < folderId.length; index += 1) {
    hash = (hash * 31 + folderId.charCodeAt(index)) % 997
  }
  return PALETTE[hash % PALETTE.length] ?? '#2f6b5a'
}

function fitTransform(nodes: PositionedNode[], width: number, height: number) {
  if (nodes.length === 0) return { x: width / 2, y: height / 2, k: 1 }
  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(120, maxX - minX)
  const spanY = Math.max(120, maxY - minY)
  const k = Math.max(0.25, Math.min(1.45, Math.min((width - 160) / spanX, (height - 130) / spanY)))
  return {
    x: width / 2 - ((minX + maxX) / 2) * k,
    y: height / 2 - ((minY + maxY) / 2) * k,
    k,
  }
}

export function GraphCanvas({ graph, folders, query, onOpen, className }: GraphCanvasProps) {
  const { t } = useI18n()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [size, setSize] = React.useState({ width: 900, height: 600 })
  const [layout, setLayout] = React.useState<{ nodes: PositionedNode[]; edges: { id: string; source: string; target: string }[] }>({
    nodes: [],
    edges: [],
  })
  const [view, setView] = React.useState({ x: 0, y: 0, k: 1 })
  const [hovered, setHovered] = React.useState<{ id: string; x: number; y: number } | null>(null)
  const [layoutError, setLayoutError] = React.useState<string | null>(null)
  const dragRef = React.useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null)

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(300, entry.contentRect.height),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    try {
      setLayoutError(null)
      if (graph.nodes.length === 0 || size.width < 10 || size.height < 10) {
        setLayout({ nodes: [], edges: [] })
        return
      }
      const simNodes: SimNode[] = graph.nodes.map((node) => ({
        ...node,
        x: size.width / 2 + (Math.random() - 0.5) * 220,
        y: size.height / 2 + (Math.random() - 0.5) * 220,
        color: colorForFolder(node.folderId),
      }))
      const simLinks: SimLink[] = graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }))
      const simulation = forceSimulation<SimNode>(simNodes)
        .force(
          'link',
          forceLink<SimNode, SimLink>(simLinks)
            .id((node) => node.id)
            .distance(126)
            .strength(0.5),
        )
        .force('charge', forceManyBody<SimNode>().strength(-250).distanceMax(900))
        .force('center', forceCenter(size.width / 2, size.height / 2))
        .force(
          'collision',
          forceCollide<SimNode>().radius((node) => 15 + Math.min(9, node.degree * 1.4)),
        )
        .stop()

      const iterations = simNodes.length > 160 ? 160 : 280
      for (let index = 0; index < iterations; index += 1) simulation.tick()
      simulation.stop()

      const nodes = simNodes.map<PositionedNode>((node) => ({
        ...node,
        x: Number.isFinite(node.x) ? (node.x ?? size.width / 2) : size.width / 2,
        y: Number.isFinite(node.y) ? (node.y ?? size.height / 2) : size.height / 2,
      }))
      setLayout({ nodes, edges: graph.edges })
    } catch (cause) {
      console.error('Graph layout failed', cause)
      setLayoutError(cause instanceof Error ? cause.message : 'unknown')
      setLayout({ nodes: [], edges: [] })
    }
  }, [graph, size.width, size.height])

  React.useEffect(() => {
    if (layout.nodes.length === 0) return
    setView(fitTransform(layout.nodes, size.width, size.height))
  }, [layout, size.width, size.height])

  const zoomBy = (factor: number, anchor?: { x: number; y: number }) => {
    setView((current) => {
      const k = Math.max(0.15, Math.min(4, current.k * factor))
      const ratio = k / current.k
      const point = anchor ?? { x: size.width / 2, y: size.height / 2 }
      return {
        k,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      }
    })
  }

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const factor = Math.exp(-event.deltaY * 0.0014)
    zoomBy(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[data-graph-node]')) return
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      viewX: view.x,
      viewY: view.y,
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    setView((current) => ({
      ...current,
      x: dragRef.current!.viewX + (event.clientX - dragRef.current!.x),
      y: dragRef.current!.viewY + (event.clientY - dragRef.current!.y),
    }))
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null
    svgRef.current?.releasePointerCapture(event.pointerId)
  }

  const hoveredNode = hovered ? layout.nodes.find((node) => node.id === hovered.id) : null
  const hoveredFolder = hoveredNode ? folderDisplayPath(folders, hoveredNode.folderId) : ''
  const nodeIds = new Set(layout.nodes.map((node) => node.id))
  const visibleEdges = layout.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

  if (layoutError) {
    return (
      <div className={cn('flex h-full items-center justify-center p-8', className)}>
        <div className="max-w-sm text-center">
          <p className="text-[13px] font-medium">{t('graph.layoutError')}</p>
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            {layoutError === 'unknown' ? t('graph.layoutErrorDesc') : layoutError} ·{' '}
            {t('graph.layoutErrorDesc')}
          </p>
          <button
            type="button"
            onClick={() => setLayoutError(null)}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-[11px] hover:bg-accent"
          >
            {t('graph.layoutRetry')}
          </button>
        </div>
      </div>
    )
  }

  if (graph.nodes.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center p-8 text-center', className)}>
        <p className="text-[12px] leading-5 text-muted-foreground">
          {t('graph.noMatch.description')}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-background', className)}
      data-testid="knowledge-graph"
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="touch-none select-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="group"
        aria-label={`${t('graph.title')} · ${t('graph.countNodes', { count: graph.nodes.length })} · ${t('graph.countEdges', { count: graph.edges.length })}`}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {visibleEdges.map((edge) => {
            const source = layout.nodes.find((node) => node.id === edge.source)
            const target = layout.nodes.find((node) => node.id === edge.target)
            if (!source || !target) return null
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="var(--border)"
                strokeWidth={1 / view.k}
                opacity={0.95}
              />
            )
          })}
          {layout.nodes.map((node) => {
            const radius = 5 + Math.min(8, node.degree * 1.15)
            const isHovered = hovered?.id === node.id
            const matchesQuery =
              query.trim().length > 0 &&
              node.title.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN'))
            const showLabel = layout.nodes.length <= 90 || node.degree > 0 || isHovered
            return (
              <g
                key={node.id}
                data-graph-node
                transform={`translate(${node.x} ${node.y})`}
                className="cursor-pointer"
                onPointerEnter={(event) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setHovered({
                    id: node.id,
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                  })
                }}
                onPointerMove={(event) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setHovered({
                    id: node.id,
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                  })
                }}
                onPointerLeave={() => setHovered(null)}
                onClick={() => onOpen(node.id)}
                role="button"
                tabIndex={0}
                aria-label={`${node.title}, ${t('graph.nodeHover', { count: node.degree })}. ${t('graph.clickOpen')}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpen(node.id)
                  }
                }}
              >
                {(matchesQuery || isHovered) && (
                  <circle
                    r={radius + 9}
                    fill="var(--primary)"
                    opacity={matchesQuery ? 0.16 : 0.09}
                  />
                )}
                <circle
                  r={radius}
                  fill={node.color}
                  stroke={isHovered || matchesQuery ? 'var(--foreground)' : 'var(--background)'}
                  strokeWidth={(isHovered ? 2 : 1.5) / view.k}
                  opacity={query.trim() && !matchesQuery ? 0.35 : 1}
                />
                {node.degree === 0 && (
                  <circle
                    r={radius + 3.5}
                    fill="none"
                    stroke="var(--muted-foreground)"
                    strokeWidth={0.7 / view.k}
                    opacity={0.35}
                    strokeDasharray={`${2 / view.k} ${3 / view.k}`}
                  />
                )}
                {showLabel && (
                  <text
                    y={radius + 13}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={10.5 / Math.max(1, view.k * 0.72)}
                    opacity={query.trim() && !matchesQuery ? 0.4 : 0.82}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.title.length > 18 ? `${node.title.slice(0, 18)}…` : node.title}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {hoveredNode && hovered && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-lg border border-border bg-popover/98 p-3 shadow-float backdrop-blur"
          style={{
            left: Math.min(hovered.x + 14, size.width - 240),
            top: Math.min(hovered.y + 14, size.height - 130),
          }}
          role="tooltip"
        >
          <p className="truncate text-[12px] font-semibold">{hoveredNode.title}</p>
          <p className="mt-1 text-[9.5px] text-muted-foreground">{hoveredFolder}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {hoveredNode.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-accent px-1.5 py-0.5 text-[8.5px] text-accent-foreground">
                #{tag}
              </span>
            ))}
          </div>
          <p className="mt-2 border-t border-border pt-1.5 text-[9px] text-muted-foreground">
            {hoveredNode.degree === 0
              ? t('graph.isolatedNode')
              : t('graph.nodeHover', { count: hoveredNode.degree })}{' '}
            · {t('graph.clickOpen')}
          </p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex items-center overflow-hidden rounded-md border border-border bg-popover/95 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1.22)}
          className="flex size-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t('graph.zoomIn')}
        >
          <Plus className="size-3.5" />
        </button>
        <span className="w-10 text-center font-mono text-[9px] text-muted-foreground">
          {Math.round(view.k * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomBy(0.82)}
          className="flex size-8 items-center justify-center border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t('graph.zoomOut')}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setView(fitTransform(layout.nodes, size.width, size.height))}
          className="flex size-8 items-center justify-center border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t('graph.fit')}
        >
          <Focus className="size-3.5" />
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-4 text-[9px] text-muted-foreground/60">
        {t('graph.panHint')}
      </p>
    </div>
  )
}
