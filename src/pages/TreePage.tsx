import { useState } from 'react';
import TreeCanvas from '../components/TreeCanvas';
import PersonSidebar from '../components/PersonSidebar';
import { FamilyTreeData } from '../types/family';

interface Props {
  data: FamilyTreeData;
}

export default function TreePage({ data }: Props) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  function handleSelectPerson(personId: string) {
    setSelectedPersonId(personId === selectedPersonId ? null : personId);
  }

  return (
    <div className="app-body">
      <TreeCanvas
        data={data}
        selectedPersonId={selectedPersonId}
        onSelectPerson={handleSelectPerson}
      />
      <PersonSidebar
        personId={selectedPersonId}
        data={data}
        onClose={() => setSelectedPersonId(null)}
        onSelect={handleSelectPerson}
      />
    </div>
  );
}
