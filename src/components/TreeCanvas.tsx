import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { FamilyTreeData, PositionedNode } from '../types/family';
import { calculateTreeLayout } from '../layout/calculateTreeLayout';
import PersonNode from './PersonNode';
import ConnectionLines from './ConnectionLines';

interface Props {
  data: FamilyTreeData;
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
}

export default function TreeCanvas({ data, selectedPersonId, onSelectPerson }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const layout = useMemo(() => calculateTreeLayout(data), [data]);

  const nodeMap = useMemo(() => {
    const map: Record<string, PositionedNode> = {};
    for (const node of layout.nodes) {
      map[node.id] = node;
    }
    return map;
  }, [layout.nodes]);

  // Highlight ancestors and descendants
  const highlighted = useMemo(() => {
    if (!selectedPersonId) return new Set<string>();

    const set = new Set<string>();
    const unions = Object.values(data.unions);

    // BFS upward (ancestors)
    const queue: string[] = [selectedPersonId];
    const visitedUp = new Set<string>();
    while (queue.length) {
      const pid = queue.shift()!;
      if (visitedUp.has(pid)) continue;
      visitedUp.add(pid);
      set.add(pid);
      // find unions where pid is a child
      for (const u of unions) {
        if (u.children.includes(pid)) {
          for (const partner of u.partners) {
            queue.push(partner);
          }
        }
      }
    }

    // BFS downward (descendants)
    const queueDown: string[] = [selectedPersonId];
    const visitedDown = new Set<string>();
    while (queueDown.length) {
      const pid = queueDown.shift()!;
      if (visitedDown.has(pid)) continue;
      visitedDown.add(pid);
      set.add(pid);
      for (const u of unions) {
        if (u.partners.includes(pid)) {
          for (const child of u.children) {
            queueDown.push(child);
          }
        }
      }
    }

    return set;
  }, [selectedPersonId, data.unions]);

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Zoom with mouse wheel
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setTransform(t => {
      const newScale = Math.min(4, Math.max(0.1, t.scale * factor));
      const scaleDiff = newScale / t.scale;
      return {
        scale: newScale,
        x: cx - scaleDiff * (cx - t.x),
        y: cy - scaleDiff * (cy - t.y),
      };
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const personNodes = layout.nodes.filter(n => n.type === 'person');
  const unionNodes = layout.nodes.filter(n => n.type === 'union');

  return (
    <div className="canvas-container">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab', display: 'block' }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          <ConnectionLines edges={layout.edges} nodeMap={nodeMap} />

          {/* Union nodes */}
          {unionNodes.map(node => {
            const union = data.unions[node.unionId!];
            const divorced = union?.status === 'divorced';
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={12}
                  ry={12}
                  fill={divorced ? '#fee2e2' : '#e2e8f0'}
                  stroke={divorced ? '#ef4444' : '#94a3b8'}
                  strokeWidth={1.5}
                />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill={divorced ? '#ef4444' : '#475569'}
                  fontFamily="system-ui, sans-serif"
                >
                  {divorced ? '✕' : '∞'}
                </text>
              </g>
            );
          })}

          {/* Person nodes */}
          {personNodes.map(node => {
            const person = data.persons[node.personId!];
            if (!person) return null;
            return (
              <PersonNode
                key={node.id}
                node={node}
                person={person}
                selected={selectedPersonId === person.id}
                highlighted={highlighted.has(person.id) && selectedPersonId !== person.id}
                onClick={onSelectPerson}
              />
            );
          })}
        </g>
      </svg>

      <div className="zoom-controls">
        <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(4, t.scale * 1.2) }))}>+</button>
        <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.1, t.scale / 1.2) }))}>−</button>
        <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>Reset</button>
      </div>
    </div>
  );
}
