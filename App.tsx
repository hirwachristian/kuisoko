

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { AppProvider } from './context/AppContext';

const App: React.FC = () => {
  return (
    <Router>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </Router>
  );
};

export default App;