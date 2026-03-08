export interface Fact {
  type: string;
  date?: string;
  place?: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  sex: 'male' | 'female' | 'other';
  birthDate?: string | null;
  deathDate?: string | null;
  facts: Fact[];
  notes?: string;
  photoUrl?: string | null;
}

export interface Union {
  id: string;
  partners: string[];
  children: string[];
  status?: string;
  facts: Fact[];
}

export interface FamilyTreeData {
  rootPersonId: string;
  persons: Record<string, Person>;
  unions: Record<string, Union>;
}

export interface PositionedNode {
  id: string;
  type: 'person' | 'union';
  x: number;
  y: number;
  width: number;
  height: number;
  personId?: string;
  unionId?: string;
}

export interface Edge {
  id: string;
  fromId: string;
  toId: string;
  type: 'partner' | 'parent-child';
  divorced?: boolean;
}
