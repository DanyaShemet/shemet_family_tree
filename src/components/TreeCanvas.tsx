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

  // Highlight ancestors, descendants, and siblings in separate sets
  const { ancestorIds, descendantIds, siblingIds, cousinIds } = useMemo(() => {
    if (!selectedPersonId) return { ancestorIds: new Set<string>(), descendantIds: new Set<string>(), siblingIds: new Set<string>(), cousinIds: new Set<string>() };

    const unions = Object.values(data.unions);

    // BFS upward — ancestors (excluding selected)
    const ancestorIds = new Set<string>();
    const queueUp: string[] = [];
    for (const u of unions) {
      if (u.children.includes(selectedPersonId)) {
        for (const p of u.partners) queueUp.push(p);
      }
    }
    const visitedUp = new Set<string>();
    while (queueUp.length) {
      const pid = queueUp.shift()!;
      if (visitedUp.has(pid)) continue;
      visitedUp.add(pid);
      ancestorIds.add(pid);
      for (const u of unions) {
        if (u.children.includes(pid)) {
          for (const p of u.partners) queueUp.push(p);
        }
      }
    }

    // BFS downward — descendants (excluding selected)
    const descendantIds = new Set<string>();
    const queueDown: string[] = [];
    for (const u of unions) {
      if (u.partners.includes(selectedPersonId)) {
        for (const c of u.children) queueDown.push(c);
      }
    }
    const visitedDown = new Set<string>();
    while (queueDown.length) {
      const pid = queueDown.shift()!;
      if (visitedDown.has(pid)) continue;
      visitedDown.add(pid);
      descendantIds.add(pid);
      for (const u of unions) {
        if (u.partners.includes(pid)) {
          for (const c of u.children) queueDown.push(c);
        }
      }
    }

    // Parents of selected — used for siblings and cousins
    const parentIds = new Set<string>();
    for (const u of unions) {
      if (u.children.includes(selectedPersonId)) {
        for (const p of u.partners) parentIds.add(p);
      }
    }

    // Siblings — share at least one parent (including half-siblings across different unions)
    const siblingIds = new Set<string>();
    for (const parentId of parentIds) {
      for (const u of unions) {
        if (u.partners.includes(parentId)) {
          for (const c of u.children) {
            if (c !== selectedPersonId) siblingIds.add(c);
          }
        }
      }
    }

    // Cousins — children of selected's parents' siblings (share a grandparent, not a parent)
    const cousinIds = new Set<string>();
    // Step 1: for each parent, find their siblings (aunts/uncles)
    const auntUncleIds = new Set<string>();
    for (const parentId of parentIds) {
      for (const u of unions) {
        if (u.children.includes(parentId)) {
          for (const c of u.children) {
            if (!parentIds.has(c)) auntUncleIds.add(c);
          }
        }
      }
    }
    // Step 3: collect children of aunts/uncles
    for (const auId of auntUncleIds) {
      for (const u of unions) {
        if (u.partners.includes(auId)) {
          for (const c of u.children) cousinIds.add(c);
        }
      }
    }

    return { ancestorIds, descendantIds, siblingIds, cousinIds };
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
    const delta = -e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 300 : 1);
    const zoomIntensity = 0.001;
    const factor = Math.max(0.8, Math.min(1.2, 1 + delta * zoomIntensity));
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
                isAncestor={ancestorIds.has(person.id)}
                isDescendant={descendantIds.has(person.id)}
                isSibling={siblingIds.has(person.id)}
                isCousin={cousinIds.has(person.id)}
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
