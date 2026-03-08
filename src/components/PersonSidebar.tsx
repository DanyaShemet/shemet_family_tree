import React from 'react';
import { FamilyTreeData, Person } from '../types/family';

interface Props {
  personId: string | null;
  data: FamilyTreeData;
  onClose: () => void;
  onSelect: (personId: string) => void;
}

function formatDate(date?: string | null): string {
  if (!date) return '—';
  return date;
}

export default function PersonSidebar({ personId, data, onClose, onSelect }: Props) {
  if (!personId) return null;

  const person = data.persons[personId];
  if (!person) return null;

  // Find unions involving this person as a partner
  const myUnions = Object.values(data.unions).filter(u => u.partners.includes(personId));

  const partners: Person[] = myUnions
    .flatMap(u => u.partners.filter(p => p !== personId))
    .map(id => data.persons[id])
    .filter(Boolean);

  const children: Person[] = myUnions
    .flatMap(u => u.children)
    .map(id => data.persons[id])
    .filter(Boolean);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>{person.firstName} {person.lastName}</h2>
        <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="sidebar-section">
        <h3>Details</h3>
        <dl>
          <dt>Sex</dt>
          <dd>{person.sex}</dd>
          <dt>Born</dt>
          <dd>{formatDate(person.birthDate)}</dd>
          <dt>Died</dt>
          <dd>{formatDate(person.deathDate)}</dd>
        </dl>
      </div>

      {person.facts.length > 0 && (
        <div className="sidebar-section">
          <h3>Facts</h3>
          <ul className="facts-list">
            {person.facts.map((fact, i) => (
              <li key={i}>
                <strong>{fact.type}</strong>
                {fact.date && ` · ${fact.date}`}
                {fact.place && ` · ${fact.place}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {partners.length > 0 && (
        <div className="sidebar-section">
          <h3>Partners</h3>
          <ul className="person-list">
            {partners.map(p => (
              <li key={p.id}>
                <button className="person-link" onClick={() => onSelect(p.id)}>
                  {p.firstName} {p.lastName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children.length > 0 && (
        <div className="sidebar-section">
          <h3>Children</h3>
          <ul className="person-list">
            {children.map(p => (
              <li key={p.id}>
                <button className="person-link" onClick={() => onSelect(p.id)}>
                  {p.firstName} {p.lastName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {person.notes && (
        <div className="sidebar-section">
          <h3>Notes</h3>
          <p>{person.notes}</p>
        </div>
      )}
    </aside>
  );
}
