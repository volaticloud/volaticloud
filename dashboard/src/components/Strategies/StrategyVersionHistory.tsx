import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Collapse,
} from '@mui/material';
import {
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assessment,
} from '@mui/icons-material';
import { useState } from 'react';

interface Version {
  id: string;
  versionNumber: number;
  version?: string | null;
  isLatest: boolean;
  createdAt: string;
  bots?: {
    totalCount: number;
  };
  backtest?: {
    id: string;
    status: string;
  } | null;
}

interface StrategyVersionHistoryProps {
  currentStrategyId: string;
  versions: Version[];
  loading: boolean;
  onVersionClick: (versionId: string) => void;
}

export const StrategyVersionHistory = ({
  currentStrategyId,
  versions,
  loading,
  onVersionClick,
}: StrategyVersionHistoryProps) => {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: open ? 2 : 0,
            cursor: 'pointer',
          }}
          onClick={() => setOpen(!open)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            <Typography variant="h6">Version History</Typography>
          </Box>
          <IconButton size="small">
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={open}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={24} />
            </Box>
          ) : versions && versions.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Bots</TableCell>
                    <TableCell>Backtest</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions
                    .slice()
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .map((version) => (
                      <TableRow
                        key={version.id}
                        hover
                        selected={version.id === currentStrategyId}
                        sx={{
                          backgroundColor:
                            version.id === currentStrategyId
                              ? 'action.selected'
                              : undefined,
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={`v${version.versionNumber}`}
                              size="small"
                              color="primary"
                              variant={version.id === currentStrategyId ? 'filled' : 'outlined'}
                            />
                            {version.isLatest && (
                              <Chip label="Latest" size="small" color="success" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {version.version || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>{version.bots?.totalCount || 0}</TableCell>
                        <TableCell>
                          <Chip
                            label={version.backtest ? 'Yes' : 'No'}
                            size="small"
                            color={version.backtest ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {version.id !== currentStrategyId && (
                            <Tooltip title="View Version">
                              <IconButton
                                size="small"
                                onClick={() => onVersionClick(version.id)}
                              >
                                <Assessment fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No other versions available.</Alert>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};
