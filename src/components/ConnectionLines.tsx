import React, { memo } from 'react';
import { Edge, PositionedNode } from '../types/family';

interface Props {
  edges: Edge[];
  nodeMap: Record<string, PositionedNode>;
}

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
];

function nodeCenter(node: PositionedNode) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

const ConnectionLines = memo(function ConnectionLines({ edges, nodeMap }: Props) {
  // Assign a stable color to each union by order of first appearance
  const unionColorMap = new Map<string, string>();
  let colorIndex = 0;
  for (const edge of edges) {
    if (!unionColorMap.has(edge.unionId)) {
      unionColorMap.set(edge.unionId, PALETTE[colorIndex % PALETTE.length]);
      colorIndex++;
    }
  }

  return (
    <g>
      {edges.map(edge => {
        const from = nodeMap[edge.fromId];
        const to = nodeMap[edge.toId];
        if (!from || !to) return null;

        const color = unionColorMap.get(edge.unionId) ?? '#94a3b8';
        const fc = nodeCenter(from);
        const tc = nodeCenter(to);

        if (edge.type === 'partner') {
          return (
            <line
              key={edge.id}
              x1={fc.x}
              y1={fc.y}
              x2={tc.x}
              y2={tc.y}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray={edge.divorced ? '5 4' : undefined}
              strokeOpacity={edge.divorced ? 0.7 : 1}
            />
          );
        }

        // parent-child: elbow line from bottom of union to top of child
        const fromBottom = { x: fc.x, y: from.y + from.height };
        const toTop = { x: tc.x, y: to.y };
        const midY = (fromBottom.y + toTop.y) / 2;

        return (
          <path
            key={edge.id}
            d={`M ${fromBottom.x} ${fromBottom.y} L ${fromBottom.x} ${midY} L ${toTop.x} ${midY} L ${toTop.x} ${toTop.y}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
});

export default ConnectionLines;
