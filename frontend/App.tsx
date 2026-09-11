

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { AppProvider } from './context/AppContext';
import { CartFlyProvider } from './context/CartFlyContext';

const App: React.FC = () => {
  return (
    <Router>
      <AppProvider>
        <CartFlyProvider>
          <MainLayout />
        </CartFlyProvider>
      </AppProvider>
    </Router>
  );
};

export default App;