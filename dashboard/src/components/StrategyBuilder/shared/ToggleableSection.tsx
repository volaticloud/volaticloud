import { useState, ReactNode } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import { Info, ExpandMore, ExpandLess } from '@mui/icons-material';

export interface ToggleableSectionProps {
  /** Title displayed in the header */
  title: string;
  /** Tooltip description */
  tooltip: string;
  /** Icon component to display (should accept color prop) */
  icon: ReactNode;
  /** Whether the section is enabled */
  enabled: boolean;
  /** Callback when enabled state changes */
  onToggle: (enabled: boolean) => void;
  /** Content to display when expanded and enabled */
  children: ReactNode;
  /** Initial expanded state (default: true) */
  defaultExpanded?: boolean;
  /** Content to show when disabled but expanded (optional) */
  disabledContent?: ReactNode;
}

/**
 * Reusable toggleable section with expand/collapse and enable/disable functionality.
 * Used by DCABuilder, StoplossBuilder, EntryConfirmBuilder.
 */
export function ToggleableSection({
  title,
  tooltip,
  icon,
  enabled,
  onToggle,
  children,
  defaultExpanded = true,
  disabledContent,
}: ToggleableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        {icon}
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          {title}
        </Typography>
        <Tooltip title={tooltip}>
          <Info fontSize="small" color="action" />
        </Tooltip>
        <Switch
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          size="small"
        />
      </Box>

      <Collapse in={expanded && enabled}>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {children}
        </Box>
      </Collapse>

      {expanded && !enabled && disabledContent && (
        <Box sx={{ mt: 2 }}>{disabledContent}</Box>
      )}
    </Paper>
  );
}

export default ToggleableSection;
