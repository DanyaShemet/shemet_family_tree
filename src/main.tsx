import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import TreePage from './pages/TreePage.tsx';
import { FamilyTreeData } from './types/family.ts';
import fullData from './data/data.json';
import shemetData from './data/shemet.json';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,    element: <TreePage data={fullData as FamilyTreeData} /> },
      { path: 'shemet', element: <TreePage data={shemetData as FamilyTreeData} /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
