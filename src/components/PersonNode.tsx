import React, { memo } from 'react';
import { Person, PositionedNode } from '../types/family';

interface Props {
  node: PositionedNode;
  person: Person;
  selected: boolean;
  isAncestor: boolean;
  isDescendant: boolean;
  isSibling: boolean;
  isCousin: boolean;
  onClick: (personId: string) => void;
}

function getYear(date?: string | null): string {
  if (!date) return '';
  return date.slice(0, 4);
}

const PHOTO_SIZE = 44;
const PHOTO_X = 8;

const PersonNode = memo(function PersonNode({ node, person, selected, isAncestor, isDescendant, isSibling, isCousin, onClick }: Props) {
  const { x, y, width, height } = node;

  let fill = person.sex === 'male' ? '#dbeafe' : person.sex === 'female' ? '#fce7f3' : '#f3f4f6';
  let stroke = '#94a3b8';
  if (selected) {
    fill = '#fef08a';
    stroke = '#ca8a04';
  } else if (isAncestor) {
    fill = '#fed7aa';
    stroke = '#ea580c';
  } else if (isDescendant) {
    fill = '#bbf7d0';
    stroke = '#16a34a';
  } else if (isSibling) {
    fill = '#e9d5ff';
    stroke = '#9333ea';
  } else if (isCousin) {
    fill = '#ccfbf1';
    stroke = '#0d9488';
  }

  const birthYear = getYear(person.birthDate);
  const deathYear = getYear(person.deathDate);
  const lifespan = birthYear || deathYear
    ? `${birthYear}${deathYear ? ` – ${deathYear}` : ''}`
    : '';

  const photoY = (height - PHOTO_SIZE) / 2;
  const photoCX = PHOTO_X + PHOTO_SIZE / 2;
  const photoCY = photoY + PHOTO_SIZE / 2;
  const textAreaLeft = PHOTO_X + PHOTO_SIZE + 8;
  const textCenterX = textAreaLeft + (width - textAreaLeft) / 2;
  const clipId = `avatar-clip-${person.id}`;

  const avatarFill = person.sex === 'male' ? '#93c5fd' : person.sex === 'female' ? '#f9a8d4' : '#d1d5db';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick(person.id)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={`${person.firstName} ${person.lastName}`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={photoCX} cy={photoCY} r={PHOTO_SIZE / 2} />
        </clipPath>
      </defs>
      <rect
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {/* Avatar circle */}
      {person.photoUrl ? (
        <image
          href={person.photoUrl}
          x={PHOTO_X}
          y={photoY}
          width={PHOTO_SIZE}
          height={PHOTO_SIZE}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <>
          <circle cx={photoCX} cy={photoCY} r={PHOTO_SIZE / 2} fill={avatarFill} />
          <text
            x={photoCX}
            y={photoCY + 6}
            textAnchor="middle"
            fontSize={17}
            fontWeight="700"
            fill="#ffffff"
            fontFamily="system-ui, sans-serif"
          >
            {person.firstName?.[0] ?? '?'}
          </text>
        </>
      )}
      <circle cx={photoCX} cy={photoCY} r={PHOTO_SIZE / 2} fill="none" stroke={stroke} strokeWidth={1} />
      {/* Name / dates */}
      <text
        x={textCenterX}
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
        x={textCenterX}
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
          x={textCenterX}
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
