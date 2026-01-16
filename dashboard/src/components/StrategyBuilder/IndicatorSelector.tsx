import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Paper,
  Collapse,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search,
  TrendingUp,
  Speed,
  ShowChart,
  BarChart,
  Code,
  ExpandMore,
  ExpandLess,
  Add,
  Delete,
  Edit,
  Info,
} from '@mui/icons-material';
import {
  IndicatorDefinition,
  IndicatorType,
  createId,
} from './types';
import {
  INDICATORS,
  INDICATOR_CATEGORIES,
  getIndicatorsByCategory,
  getDefaultParams,
  IndicatorMeta,
} from './indicatorMeta';

const CATEGORY_ICONS = {
  trend: TrendingUp,
  momentum: Speed,
  volatility: ShowChart,
  volume: BarChart,
  custom: Code,
} as const;

interface IndicatorSelectorProps {
  indicators: IndicatorDefinition[];
  onChange: (indicators: IndicatorDefinition[]) => void;
}

export function IndicatorSelector({ indicators, onChange }: IndicatorSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['trend', 'momentum']));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<IndicatorDefinition | null>(null);
  const [selectedType, setSelectedType] = useState<IndicatorType | null>(null);

  // Filter indicators by search
  const filteredIndicators = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    return Object.values(INDICATORS).filter(
      (ind) =>
        ind.name.toLowerCase().includes(query) ||
        ind.description.toLowerCase().includes(query) ||
        ind.type.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAddIndicator = (meta: IndicatorMeta) => {
    setSelectedType(meta.type);
    setEditingIndicator({
      id: createId(),
      type: meta.type,
      params: getDefaultParams(meta.type),
      label: `${meta.name} ${indicators.filter((i) => i.type === meta.type).length + 1}`,
    });
    setDialogOpen(true);
  };

  const handleEditIndicator = (indicator: IndicatorDefinition) => {
    setSelectedType(indicator.type);
    setEditingIndicator({ ...indicator });
    setDialogOpen(true);
  };

  const handleDeleteIndicator = (id: string) => {
    onChange(indicators.filter((i) => i.id !== id));
  };

  const handleSaveIndicator = () => {
    if (!editingIndicator) return;

    const existing = indicators.find((i) => i.id === editingIndicator.id);
    if (existing) {
      // Update existing
      onChange(indicators.map((i) => (i.id === editingIndicator.id ? editingIndicator : i)));
    } else {
      // Add new
      onChange([...indicators, editingIndicator]);
    }
    setDialogOpen(false);
    setEditingIndicator(null);
    setSelectedType(null);
  };

  const handleParamChange = (paramName: string, value: unknown) => {
    if (!editingIndicator) return;
    setEditingIndicator({
      ...editingIndicator,
      params: {
        ...editingIndicator.params,
        [paramName]: value,
      },
    });
  };

  const renderIndicatorList = (meta: IndicatorMeta) => {
    const Icon = CATEGORY_ICONS[meta.category];
    const existingCount = indicators.filter((i) => i.type === meta.type).length;

    return (
      <ListItemButton
        key={meta.type}
        onClick={() => handleAddIndicator(meta)}
        sx={{ pl: 4 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" color="action" />
        </ListItemIcon>
        <ListItemText
          primary={meta.name}
          secondary={meta.description}
          primaryTypographyProps={{ variant: 'body2' }}
          secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
        />
        {existingCount > 0 && (
          <Chip label={existingCount} size="small" color="primary" sx={{ ml: 1 }} />
        )}
        <Tooltip title="Add indicator">
          <Add fontSize="small" color="action" sx={{ ml: 1 }} />
        </Tooltip>
      </ListItemButton>
    );
  };

  const renderCategory = (categoryKey: keyof typeof INDICATOR_CATEGORIES) => {
    const category = INDICATOR_CATEGORIES[categoryKey];
    const categoryIndicators = getIndicatorsByCategory(categoryKey);
    const isExpanded = expandedCategories.has(categoryKey);
    const Icon = CATEGORY_ICONS[categoryKey];

    return (
      <Box key={categoryKey}>
        <ListItemButton onClick={() => toggleCategory(categoryKey)}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Icon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary={category.label}
            secondary={category.description}
            primaryTypographyProps={{ fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={isExpanded}>
          <List disablePadding>
            {categoryIndicators.map(renderIndicatorList)}
          </List>
        </Collapse>
      </Box>
    );
  };

  const currentMeta = selectedType ? INDICATORS[selectedType] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Active Indicators */}
      {indicators.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Active Indicators ({indicators.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {indicators.map((ind) => {
              const meta = INDICATORS[ind.type];
              return (
                <Chip
                  key={ind.id}
                  label={ind.label || meta?.name || ind.type}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => handleDeleteIndicator(ind.id)}
                  onClick={() => handleEditIndicator(ind)}
                  deleteIcon={<Delete fontSize="small" />}
                  icon={<Edit fontSize="small" />}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search indicators..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }
        }}
        sx={{ mb: 2 }}
      />

      {/* Indicator List */}
      <Paper variant="outlined" sx={{ flex: 1, overflow: 'auto' }}>
        <List disablePadding>
          {filteredIndicators ? (
            // Search results
            filteredIndicators.length > 0 ? (
              filteredIndicators.map(renderIndicatorList)
            ) : (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="body2">
                  No indicators found
                </Typography>
              </Box>
            )
          ) : (
            // Category view
            <>
              {renderCategory('trend')}
              <Divider />
              {renderCategory('momentum')}
              <Divider />
              {renderCategory('volatility')}
              <Divider />
              {renderCategory('volume')}
            </>
          )}
        </List>
      </Paper>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndicator && indicators.find((i) => i.id === editingIndicator.id)
            ? 'Edit Indicator'
            : 'Add Indicator'}
          {currentMeta && (
            <Typography variant="body2" color="text.secondary">
              {currentMeta.name} - {currentMeta.description}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {editingIndicator && currentMeta && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {/* Label */}
              <TextField
                label="Label"
                value={editingIndicator.label || ''}
                onChange={(e) =>
                  setEditingIndicator({ ...editingIndicator, label: e.target.value })
                }
                size="small"
                fullWidth
                helperText="Custom name for this indicator instance"
              />

              {/* Parameters */}
              {currentMeta.params.map((param) => {
                const value = editingIndicator.params[param.name] ?? param.default;

                if (param.type === 'select' && param.options) {
                  return (
                    <FormControl key={param.name} size="small" fullWidth>
                      <InputLabel>{param.label}</InputLabel>
                      <Select
                        value={value as string}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        label={param.label}
                      >
                        {param.options.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                }

                return (
                  <TextField
                    key={param.name}
                    label={param.label}
                    type={param.type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) =>
                      handleParamChange(
                        param.name,
                        param.type === 'number' ? parseFloat(e.target.value) : e.target.value
                      )
                    }
                    size="small"
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        min: param.min,
                        max: param.max,
                        step: param.type === 'number' && typeof value === 'number' && value < 1 ? 0.01 : 1,
                      }
                    }}
                    helperText={param.description}
                  />
                );
              })}

              {/* Outputs */}
              {currentMeta.outputs.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Info fontSize="small" color="action" />
                    Available Outputs
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {currentMeta.outputs.map((output) => (
                      <Tooltip key={output.name} title={output.description}>
                        <Chip
                          label={output.field ? `${output.name} (.${output.field})` : output.name}
                          size="small"
                          variant="outlined"
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveIndicator}>
            {editingIndicator && indicators.find((i) => i.id === editingIndicator.id)
              ? 'Update'
              : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
