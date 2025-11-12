import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { extractTrades } from '../../types/freqtrade';

interface BacktestTradesProps {
  result: any;
}

export const BacktestTrades = ({ result }: BacktestTradesProps) => {
  const [tradesOpen, setTradesOpen] = useState(false);

  const trades = extractTrades(result);

  if (!trades || trades.length === 0) {
    return null;
  }

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: tradesOpen ? 2 : 0,
          cursor: 'pointer',
        }}
        onClick={() => setTradesOpen(!tradesOpen)}
      >
        <Typography variant="h6">
          Trades ({trades.length})
        </Typography>
        <IconButton size="small">
          {tradesOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={tradesOpen}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Pair</TableCell>
                <TableCell>Open Date</TableCell>
                <TableCell>Close Date</TableCell>
                <TableCell align="right">Profit %</TableCell>
                <TableCell align="right">Profit</TableCell>
                <TableCell align="right">Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((trade, index) => (
                <TableRow key={index} hover>
                  <TableCell>{trade.pair}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(trade.open_date).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(trade.close_date).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={trade.profit_ratio > 0 ? 'success.main' : 'error.main'}
                      fontWeight={600}
                    >
                      {(trade.profit_ratio * 100).toFixed(2)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={trade.profit_abs > 0 ? 'success.main' : 'error.main'}
                    >
                      {trade.profit_abs.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">
                      {trade.trade_duration || 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </>
  );
};