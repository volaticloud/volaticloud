import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import {
  NotificationsActive as RulesIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { AlertRulesTab } from './AlertRulesTab';
import { AlertHistoryTab } from './AlertHistoryTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`alerts-tabpanel-${index}`}
      aria-labelledby={`alerts-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `alerts-tab-${index}`,
    'aria-controls': `alerts-tabpanel-${index}`,
  };
}

export const AlertsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tabValue, setTabValue] = useState(tabParam === 'history' ? 1 : 0);

  // Sync tab with URL param
  useEffect(() => {
    const newTab = tabParam === 'history' ? 1 : 0;
    if (newTab !== tabValue) {
      setTabValue(newTab);
    }
  }, [tabParam, tabValue]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Update URL param while preserving other params (like groupId)
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue === 1) {
        newParams.set('tab', 'history');
      } else {
        newParams.delete('tab');
      }
      return newParams;
    });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          Alerts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure alert rules for your bots and backtests
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="alerts tabs">
          <Tab
            icon={<RulesIcon />}
            iconPosition="start"
            label="Rules"
            {...a11yProps(0)}
          />
          <Tab
            icon={<HistoryIcon />}
            iconPosition="start"
            label="History"
            {...a11yProps(1)}
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <AlertRulesTab />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <AlertHistoryTab />
      </TabPanel>
    </Box>
  );
};