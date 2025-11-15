import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { createAppTheme } from './theme/theme';
import { createApolloClient } from './graphql/client';
import { useConfigValue } from './contexts/ConfigContext';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { BotsPage } from './pages/Bots/BotsPage';
import { BotDetailPage } from './pages/Bots/BotDetailPage';
import { ExchangesPage } from './pages/Exchanges/ExchangesPage';
import { StrategiesPage } from './pages/Strategies/StrategiesPage';
import { StrategyDetailPage } from './pages/Strategies/StrategyDetailPage';
import { RunnersPage } from './pages/Runners/RunnersPage';
import { BacktestsPage } from './pages/BacktestsPage';
import { BacktestDetailPage } from './pages/Backtests/BacktestDetailPage';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const graphqlUrl = useConfigValue('ANYTRADE__GRAPHQL_URL');

  const theme = useMemo(() => createAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);
  const apolloClient = useMemo(() => createApolloClient(graphqlUrl), [graphqlUrl]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            html: { overflowX: 'hidden' },
            body: { overflowX: 'hidden' },
          }}
        />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={<DashboardLayout darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />}
            >
              <Route index element={<DashboardPage />} />
              <Route path="bots" element={<BotsPage />} />
              <Route path="bots/:id" element={<BotDetailPage />} />
              <Route path="exchanges" element={<ExchangesPage />} />
              <Route path="strategies" element={<StrategiesPage />} />
              <Route path="strategies/:id" element={<StrategyDetailPage />} />
              <Route path="backtests" element={<BacktestsPage />} />
              <Route path="backtests/:id" element={<BacktestDetailPage />} />
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
