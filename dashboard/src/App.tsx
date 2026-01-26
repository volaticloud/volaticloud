import { useState, useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { createAppTheme } from './theme/theme';
import { createApolloClient } from './graphql/client';
import { useConfigValue } from './contexts/ConfigContext';
import { useAuth } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { PermissionProvider } from './contexts/PermissionContext';
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
import { TradesPage } from './pages/Trades/TradesPage';
import { AlertsPage } from './pages/Alerts/AlertsPage';
import { ProfileLayout } from './components/Layout/ProfileLayout';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { CredentialsPage } from './pages/Profile/CredentialsPage';
import { SessionsPage } from './pages/Profile/SessionsPage';
import { TwoFactorPage } from './pages/Profile/TwoFactorPage';
import { OrganizationLayout } from './components/Layout/OrganizationLayout';
import { OrganizationDetailsPage } from './pages/Organization/OrganizationDetailsPage';
import { OrganizationUsersPage } from './pages/Organization/OrganizationUsersPage';
import { OrganizationUsagePage } from './pages/Organization/OrganizationUsagePage';
import { OrganizationBillingPage } from './pages/Organization/OrganizationBillingPage';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return false; // Default to light mode
  });
  const gatewayUrl = useConfigValue('VOLATICLOUD__GATEWAY_URL');
  const auth = useAuth();

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const theme = useMemo(() => createAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  // Create Apollo client with auth token and WebSocket for subscriptions
  // GraphQL endpoint is at {gatewayUrl}/query
  // WebSocket uses the same endpoint with ws:// protocol (gqlgen handles both)
  const apolloClient = useMemo(() => {
    const getAccessToken = () => auth.user?.access_token;
    // Convert http(s):// to ws(s):// for WebSocket URL - same endpoint handles both
    const wsUrl = gatewayUrl.replace(/^http/, 'ws') + '/query';
    return createApolloClient(`${gatewayUrl}/query`, wsUrl, getAccessToken);
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
          <OrganizationProvider>
            <PermissionProvider>
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
                    <Route path="alerts" element={<AlertsPage />} />
                  </Route>
                  <Route
                    path="profile"
                    element={<ProfileLayout darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />}
                  >
                    <Route index element={<ProfilePage />} />
                    <Route path="credentials" element={<CredentialsPage />} />
                    <Route path="sessions" element={<SessionsPage />} />
                    <Route path="two-factor" element={<TwoFactorPage />} />
                  </Route>
                  <Route
                    path="organization"
                    element={<OrganizationLayout darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />}
                  >
                    <Route path="details" element={<OrganizationDetailsPage />} />
                    <Route path="users" element={<OrganizationUsersPage />} />
                    <Route path="users/:resourceGroupId" element={<OrganizationUsersPage />} />
                    <Route path="usage" element={<OrganizationUsagePage />} />
                    <Route path="billing" element={<OrganizationBillingPage />} />
                  </Route>
                </Routes>
              </SidebarProvider>
            </PermissionProvider>
          </OrganizationProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ApolloProvider>
  );
}

export default App;
