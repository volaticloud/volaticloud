/**
 * Chart theming that integrates with MUI theme
 */
import type { ChartTheme } from './types';

/**
 * Dark theme for charts
 */
export const darkTheme: ChartTheme = {
  backgroundColor: '#1e1e1e',
  textColor: '#d1d4dc',
  gridColor: 'rgba(255, 255, 255, 0.06)',
  upColor: '#26a69a',
  downColor: '#ef5350',
  borderUpColor: '#26a69a',
  borderDownColor: '#ef5350',
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
  volumeUpColor: 'rgba(38, 166, 154, 0.5)',
  volumeDownColor: 'rgba(239, 83, 80, 0.5)',
  crosshairColor: '#758696',
  lineColor: '#2196f3',
  areaTopColor: 'rgba(33, 150, 243, 0.4)',
  areaBottomColor: 'rgba(33, 150, 243, 0.0)',
};

/**
 * Light theme for charts
 */
export const lightTheme: ChartTheme = {
  backgroundColor: '#ffffff',
  textColor: '#191919',
  gridColor: 'rgba(0, 0, 0, 0.06)',
  upColor: '#26a69a',
  downColor: '#ef5350',
  borderUpColor: '#26a69a',
  borderDownColor: '#ef5350',
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
  volumeUpColor: 'rgba(38, 166, 154, 0.5)',
  volumeDownColor: 'rgba(239, 83, 80, 0.5)',
  crosshairColor: '#9B9B9B',
  lineColor: '#2196f3',
  areaTopColor: 'rgba(33, 150, 243, 0.4)',
  areaBottomColor: 'rgba(33, 150, 243, 0.0)',
};

/**
 * Get chart theme based on MUI mode
 */
export function getChartTheme(mode: 'light' | 'dark'): ChartTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

/**
 * Drawdown-specific colors (always red tones)
 */
export const drawdownColors = {
  line: '#ef5350',
  areaTop: 'rgba(239, 83, 80, 0.4)',
  areaBottom: 'rgba(239, 83, 80, 0.0)',
};

/**
 * Profit colors for bars/markers
 */
export const profitColors = {
  positive: '#26a69a',
  negative: '#ef5350',
  neutral: '#9e9e9e',
};