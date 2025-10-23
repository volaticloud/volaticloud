import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from './theme/theme';
import { client } from './graphql/client';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { BotsPage } from './pages/Bots/BotsPage';
import { ExchangesPage } from './pages/Exchanges/ExchangesPage';
import { StrategiesPage } from './pages/Strategies/StrategiesPage';
import { RunnersPage } from './pages/Runners/RunnersPage';

function App() {
  const [darkMode, setDarkMode] = useState(true);

  const theme = useMemo(() => createAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={<DashboardLayout darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />}
            >
              <Route index element={<DashboardPage />} />
              <Route path="bots" element={<BotsPage />} />
              <Route path="exchanges" element={<ExchangesPage />} />
              <Route path="strategies" element={<StrategiesPage />} />
              <Route path="backtests" element={<div>Backtests (Coming Soon)</div>} />
              <Route path="trades" element={<div>Trades (Coming Soon)</div>} />
              <Route path="runners" element={<RunnersPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ApolloProvider>
  );
}

export default App;
