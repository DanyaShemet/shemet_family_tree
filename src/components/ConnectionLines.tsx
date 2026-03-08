import React, { memo } from 'react';
import { Edge, PositionedNode } from '../types/family';

interface Props {
  edges: Edge[];
  nodeMap: Record<string, PositionedNode>;
}

function nodeCenter(node: PositionedNode) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

const ConnectionLines = memo(function ConnectionLines({ edges, nodeMap }: Props) {
  return (
    <g>
      {edges.map(edge => {
        const from = nodeMap[edge.fromId];
        const to = nodeMap[edge.toId];
        if (!from || !to) return null;

        const fc = nodeCenter(from);
        const tc = nodeCenter(to);

        if (edge.type === 'partner') {
          const divorced = edge.divorced;
          return (
            <line
              key={edge.id}
              x1={fc.x}
              y1={fc.y}
              x2={tc.x}
              y2={tc.y}
              stroke={divorced ? '#ef4444' : '#94a3b8'}
              strokeWidth={1.5}
              strokeDasharray={divorced ? '5 4' : undefined}
            />
          );
        }

        // parent-child: vertical line from bottom of union/person to top of child
        const fromBottom = { x: fc.x, y: from.y + from.height };
        const toTop = { x: tc.x, y: to.y };
        const midY = (fromBottom.y + toTop.y) / 2;

        return (
          <path
            key={edge.id}
            d={`M ${fromBottom.x} ${fromBottom.y} L ${fromBottom.x} ${midY} L ${toTop.x} ${midY} L ${toTop.x} ${toTop.y}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
});

export default ConnectionLines;
