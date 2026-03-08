import { useState } from 'react';
import TreeCanvas from './components/TreeCanvas';
import PersonSidebar from './components/PersonSidebar';
import { FamilyTreeData } from './types/family';
import data from './data/data.json';

const familyData = data as FamilyTreeData;

export default function App() {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  function handleSelectPerson(personId: string) {
    setSelectedPersonId(personId === selectedPersonId ? null : personId);
  }

  function handleClose() {
    setSelectedPersonId(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Family Tree</h1>
        <span className="person-count">
          {Object.keys(familyData.persons).length} people
        </span>
      </header>
      <div className="app-body">
        <TreeCanvas
          data={familyData}
          selectedPersonId={selectedPersonId}
          onSelectPerson={handleSelectPerson}
        />
        <PersonSidebar
          personId={selectedPersonId}
          data={familyData}
          onClose={handleClose}
          onSelect={handleSelectPerson}
        />
      </div>
    </div>
  );
}
