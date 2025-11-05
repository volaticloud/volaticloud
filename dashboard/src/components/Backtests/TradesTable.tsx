import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface Trade {
  pair?: string;
  profit_ratio?: number;
  profit_abs?: number;
  open_date?: string;
  close_date?: string;
  open_rate?: number;
  close_rate?: number;
  amount?: number;
  trade_duration?: number;
  sell_reason?: string;
}

interface TradesTableProps {
  trades: Trade[];
}

const TradesTable: React.FC<TradesTableProps> = ({ trades }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (!trades || trades.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No trades found
        </Typography>
      </Paper>
    );
  }

  const paginatedTrades = trades.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pair</TableCell>
              <TableCell align="right">Profit %</TableCell>
              <TableCell align="right">Profit</TableCell>
              <TableCell align="right">Entry Price</TableCell>
              <TableCell align="right">Exit Price</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Duration (min)</TableCell>
              <TableCell>Open Date</TableCell>
              <TableCell>Close Date</TableCell>
              <TableCell>Exit Reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTrades.map((trade, index) => {
              const profitRatio = trade.profit_ratio || 0;
              const profitAbs = trade.profit_abs || 0;
              const isProfit = profitAbs >= 0;

              return (
                <TableRow key={index} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {isProfit ? (
                        <TrendingUp fontSize="small" color="success" sx={{ mr: 1 }} />
                      ) : (
                        <TrendingDown fontSize="small" color="error" sx={{ mr: 1 }} />
                      )}
                      <strong>{trade.pair || 'N/A'}</strong>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={isProfit ? 'success.main' : 'error.main'}
                      fontWeight="bold"
                    >
                      {(profitRatio * 100).toFixed(2)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={isProfit ? 'success.main' : 'error.main'}
                    >
                      ${profitAbs.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    ${(trade.open_rate || 0).toFixed(6)}
                  </TableCell>
                  <TableCell align="right">
                    ${(trade.close_rate || 0).toFixed(6)}
                  </TableCell>
                  <TableCell align="right">
                    {(trade.amount || 0).toFixed(4)}
                  </TableCell>
                  <TableCell align="right">
                    {trade.trade_duration || 0}
                  </TableCell>
                  <TableCell>
                    {trade.open_date
                      ? new Date(trade.open_date).toLocaleString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {trade.close_date
                      ? new Date(trade.close_date).toLocaleString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={trade.sell_reason || 'N/A'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        component="div"
        count={trades.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default TradesTable;