import React, { memo } from 'react';
import { Person, PositionedNode } from '../types/family';

interface Props {
  node: PositionedNode;
  person: Person;
  selected: boolean;
  highlighted: boolean;
  onClick: (personId: string) => void;
}

function getYear(date?: string | null): string {
  if (!date) return '';
  return date.slice(0, 4);
}

const PersonNode = memo(function PersonNode({ node, person, selected, highlighted, onClick }: Props) {
  const { x, y, width, height } = node;

  let fill = person.sex === 'male' ? '#dbeafe' : person.sex === 'female' ? '#fce7f3' : '#f3f4f6';
  let stroke = '#94a3b8';
  if (selected) {
    fill = '#fef08a';
    stroke = '#ca8a04';
  } else if (highlighted) {
    fill = '#bbf7d0';
    stroke = '#16a34a';
  }

  const birthYear = getYear(person.birthDate);
  const deathYear = getYear(person.deathDate);
  const lifespan = birthYear || deathYear
    ? `${birthYear}${deathYear ? ` – ${deathYear}` : ''}`
    : '';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick(person.id)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={`${person.firstName} ${person.lastName}`}
    >
      <rect
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <text
        x={width / 2}
        y={22}
        textAnchor="middle"
        fontSize={13}
        fontWeight="600"
        fill="#1e293b"
        fontFamily="system-ui, sans-serif"
      >
        {person.firstName}
      </text>
      <text
        x={width / 2}
        y={38}
        textAnchor="middle"
        fontSize={12}
        fill="#475569"
        fontFamily="system-ui, sans-serif"
      >
        {person.lastName}
      </text>
      {lifespan && (
        <text
          x={width / 2}
          y={56}
          textAnchor="middle"
          fontSize={11}
          fill="#64748b"
          fontFamily="system-ui, sans-serif"
        >
          {lifespan}
        </text>
      )}
    </g>
  );
});

export default PersonNode;
