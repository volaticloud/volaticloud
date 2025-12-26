import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { createAppTheme } from './theme/theme';
import { createApolloClient } from './graphql/client';
import { useConfigValue } from './contexts/ConfigContext';
import { useAuth } from './contexts/AuthContext';
import { GroupProvider } from './contexts/GroupContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { BotsPage } from './pages/Bots/BotsPage';
import { BotDetailPage } from './pages/Bots/BotDetailPage';
import { ExchangesPage } from './pages/Exchanges/ExchangesPage';
import { StrategiesPage } from './pages/Strategies/StrategiesPage';
import { StrategyDetailPage } from './pages/Strategies/StrategyDetailPage';
import { StrategyStudioPage } from './pages/Strategies/StrategyStudioPage';
import { RunnersPage } from './pages/Runners/RunnersPage';
import { BacktestsPage } from './pages/BacktestsPage';
import { BacktestDetailPage } from './pages/Backtests/BacktestDetailPage';
import { UsagePage } from './pages/Usage/UsagePage';
import { TradesPage } from './pages/Trades/TradesPage';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const gatewayUrl = useConfigValue('VOLATICLOUD__GATEWAY_URL');
  const auth = useAuth();

  const theme = useMemo(() => createAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  // Create Apollo client with auth token
  // GraphQL endpoint is at {gatewayUrl}/query
  const apolloClient = useMemo(() => {
    const getAccessToken = () => auth.user?.access_token;
    return createApolloClient(`${gatewayUrl}/query`, getAccessToken);
  }, [gatewayUrl, auth.user?.access_token]);

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
          <GroupProvider>
            <SidebarProvider>
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
                <Route path="strategies/new" element={<StrategyStudioPage />} />
                <Route path="strategies/:id" element={<StrategyDetailPage />} />
                <Route path="strategies/:id/edit" element={<StrategyStudioPage />} />
                <Route path="backtests" element={<BacktestsPage />} />
                <Route path="backtests/:id" element={<BacktestDetailPage />} />
                <Route path="trades" element={<TradesPage />} />
                <Route path="runners" element={<RunnersPage />} />
                <Route path="usage" element={<UsagePage />} />
              </Route>
              </Routes>
            </SidebarProvider>
          </GroupProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ApolloProvider>
  );
}

export default App;
