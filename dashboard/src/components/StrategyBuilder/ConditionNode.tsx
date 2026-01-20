import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Select,
  FormControl,
  Tooltip,
  Divider,
  Chip,
  Button,
  Collapse,
} from '@mui/material';
import {
  MoreVert,
  Delete,
  Add,
  WrapText,
  SwapHoriz,
  Block,
  CallSplit,
  TrendingUp,
  TrendingDown,
  ExpandMore,
  ExpandLess,
  VisibilityOff,
} from '@mui/icons-material';
import { CONDITION_DEPTH_COLORS } from '../../theme/theme';
import {
  ConditionNode as ConditionNodeType,
  IndicatorDefinition,
  ComparisonOperator,
  AndNode,
  OrNode,
  NotNode,
  CompareNode,
  CrossoverNode,
  CrossunderNode,
  IfThenElseNode,
  isAndNode,
  isOrNode,
  isNotNode,
  isCompareNode,
  isCrossoverNode,
  isCrossunderNode,
  isIfThenElseNode,
  createAndNode,
  createOrNode,
  createNotNode,
  createCompareNode,
  createConstantOperand,
  createIndicatorOperand,
  createCrossoverNode,
  createCrossunderNode,
  createId,
  OPERATOR_SYMBOLS,
} from './types';
import { OperandEditor } from './OperandEditor';

interface ConditionNodeProps {
  node: ConditionNodeType;
  onChange: (node: ConditionNodeType) => void;
  onDelete?: () => void;
  indicators: IndicatorDefinition[];
  depth?: number;
  showTradeContext?: boolean;
  /** When true, all editing is disabled (used for mirrored signals) */
  readOnly?: boolean;
}

export function ConditionNodeEditor({
  node,
  onChange,
  onDelete,
  indicators,
  depth = 0,
  showTradeContext = false,
  readOnly = false,
}: ConditionNodeProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const borderColor = CONDITION_DEPTH_COLORS[depth % CONDITION_DEPTH_COLORS.length];
  const isDisabled = node.disabled === true;

  const handleToggleDisabled = () => {
    onChange({ ...node, disabled: !isDisabled });
    setMenuAnchor(null);
  };

  const handleWrapInNot = () => {
    onChange(createNotNode(node));
    setMenuAnchor(null);
  };

  const handleWrapInIf = () => {
    onChange({
      id: createId(),
      type: 'IF_THEN_ELSE',
      condition: createCompareNode(
        indicators.length > 0
          ? createIndicatorOperand(indicators[0].id)
          : createConstantOperand(0),
        ComparisonOperator.Gt,
        createConstantOperand(0)
      ),
      then: node,
    } as IfThenElseNode);
    setMenuAnchor(null);
  };

  const handleConvertToAnd = () => {
    if (isOrNode(node)) {
      onChange({
        ...node,
        type: 'AND',
      } as AndNode);
    }
    setMenuAnchor(null);
  };

  const handleConvertToOr = () => {
    if (isAndNode(node)) {
      onChange({
        ...node,
        type: 'OR',
      } as OrNode);
    }
    setMenuAnchor(null);
  };

  // Render AND/OR group
  if (isAndNode(node) || isOrNode(node)) {
    const isAnd = isAndNode(node);
    const groupNode = node as AndNode | OrNode;

    const handleAddCondition = () => {
      const defaultOperand = indicators.length > 0
        ? createIndicatorOperand(indicators[0].id)
        : createConstantOperand(0);

      const newCondition = createCompareNode(
        defaultOperand,
        ComparisonOperator.Gt,
        createConstantOperand(0)
      );

      onChange({
        ...groupNode,
        children: [...groupNode.children, newCondition],
      });
    };

    const handleAddGroup = () => {
      const newGroup = isAnd ? createOrNode([]) : createAndNode([]);
      onChange({
        ...groupNode,
        children: [...groupNode.children, newGroup],
      });
    };

    const handleAddCrossover = () => {
      if (indicators.length >= 2) {
        const newCross = createCrossoverNode(
          createIndicatorOperand(indicators[0].id),
          createIndicatorOperand(indicators[1].id)
        );
        onChange({
          ...groupNode,
          children: [...groupNode.children, newCross],
        });
      }
    };

    const handleChildChange = (index: number, newChild: ConditionNodeType) => {
      const newChildren = [...groupNode.children];
      newChildren[index] = newChild;
      onChange({
        ...groupNode,
        children: newChildren,
      });
    };

    const handleChildDelete = (index: number) => {
      onChange({
        ...groupNode,
        children: groupNode.children.filter((_, i) => i !== index),
      });
    };

    const handleAddCrossunder = () => {
      if (indicators.length >= 2) {
        const newCross = createCrossunderNode(
          createIndicatorOperand(indicators[0].id),
          createIndicatorOperand(indicators[1].id)
        );
        onChange({
          ...groupNode,
          children: [...groupNode.children, newCross],
        });
      }
    };

    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderLeft: 3,
          borderLeftColor: isDisabled ? 'grey.400' : borderColor,
          bgcolor: 'background.default',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: collapsed ? 0 : 1, gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setCollapsed(!collapsed)}
            sx={{ p: 0.5 }}
          >
            {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
          </IconButton>

          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={node.type}
              onChange={(e) => {
                if (e.target.value === 'AND') handleConvertToAnd();
                else handleConvertToOr();
              }}
              sx={{ fontWeight: 600 }}
              disabled={isDisabled || readOnly}
            >
              <MenuItem value="AND">AND</MenuItem>
              <MenuItem value="OR">OR</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="text.secondary">
            {groupNode.children.length === 0
              ? 'Empty group'
              : `${groupNode.children.length} condition${groupNode.children.length !== 1 ? 's' : ''}`}
          </Typography>

          {isDisabled && (
            <Tooltip title="This condition is disabled">
              <VisibilityOff fontSize="small" color="disabled" />
            </Tooltip>
          )}

          <Box sx={{ flex: 1 }} />

          {!readOnly && (
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Collapsible Children */}
        <Collapse in={!collapsed}>
          {/* Children */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {groupNode.children.map((child, index) => (
              <Box key={child.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {index > 0 && (
                  <Chip
                    label={isAnd ? 'AND' : 'OR'}
                    size="small"
                    sx={{ mt: 1, minWidth: 45 }}
                    color={isAnd ? 'primary' : 'secondary'}
                    variant="outlined"
                  />
                )}
                {index === 0 && <Box sx={{ minWidth: 45 }} />}
                <Box sx={{ flex: 1 }}>
                  <ConditionNodeEditor
                    node={child}
                    onChange={(newChild) => handleChildChange(index, newChild)}
                    onDelete={readOnly ? undefined : () => handleChildDelete(index)}
                    indicators={indicators}
                    depth={depth + 1}
                    showTradeContext={showTradeContext}
                    readOnly={readOnly}
                  />
                </Box>
              </Box>
            ))}
          </Box>

          {/* Add buttons - hidden when readOnly */}
          {!readOnly && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={handleAddCondition}
                variant="outlined"
                disabled={isDisabled}
              >
                Condition
              </Button>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={handleAddGroup}
                variant="outlined"
                disabled={isDisabled}
              >
                Group
              </Button>
              {indicators.length >= 2 && (
                <>
                  <Button
                    size="small"
                    startIcon={<TrendingUp />}
                    onClick={handleAddCrossover}
                    variant="outlined"
                    disabled={isDisabled}
                  >
                    Crossover
                  </Button>
                  <Button
                    size="small"
                    startIcon={<TrendingDown />}
                    onClick={handleAddCrossunder}
                    variant="outlined"
                    disabled={isDisabled}
                  >
                    Crossunder
                  </Button>
                </>
              )}
            </Box>
          )}
        </Collapse>

        {/* Context menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={handleToggleDisabled}>
            <ListItemIcon><VisibilityOff fontSize="small" /></ListItemIcon>
            <ListItemText>{isDisabled ? 'Enable' : 'Disable'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleWrapInNot}>
            <ListItemIcon><Block fontSize="small" /></ListItemIcon>
            <ListItemText>Wrap in NOT</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleWrapInIf}>
            <ListItemIcon><CallSplit fontSize="small" /></ListItemIcon>
            <ListItemText>Wrap in IF</ListItemText>
          </MenuItem>
          {onDelete && (
            <>
              <Divider />
              <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Paper>
    );
  }

  // Render NOT node
  if (isNotNode(node)) {
    const notNode = node as NotNode;

    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderLeft: 3,
          borderLeftColor: isDisabled ? 'grey.400' : 'error.main',
          bgcolor: 'background.default',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
          <Chip label="NOT" size="small" color="error" />
          {isDisabled && (
            <Tooltip title="This condition is disabled">
              <VisibilityOff fontSize="small" color="disabled" />
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          {!readOnly && (
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Box>

        <ConditionNodeEditor
          node={notNode.child}
          onChange={(newChild) => onChange({ ...notNode, child: newChild })}
          indicators={indicators}
          depth={depth + 1}
          showTradeContext={showTradeContext}
          readOnly={readOnly}
        />

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={handleToggleDisabled}>
            <ListItemIcon><VisibilityOff fontSize="small" /></ListItemIcon>
            <ListItemText>{isDisabled ? 'Enable' : 'Disable'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { onChange(notNode.child); setMenuAnchor(null); }}>
            <ListItemIcon><WrapText fontSize="small" /></ListItemIcon>
            <ListItemText>Remove NOT (unwrap)</ListItemText>
          </MenuItem>
          {onDelete && (
            <>
              <Divider />
              <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Paper>
    );
  }

  // Render COMPARE node
  if (isCompareNode(node)) {
    const cmpNode = node as CompareNode;

    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          bgcolor: 'background.paper',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {isDisabled && (
          <Tooltip title="This condition is disabled">
            <VisibilityOff fontSize="small" color="disabled" sx={{ mr: 0.5 }} />
          </Tooltip>
        )}

        <OperandEditor
          value={cmpNode.left}
          onChange={(left) => onChange({ ...cmpNode, left })}
          indicators={indicators}
          showTradeContext={showTradeContext}
          readOnly={readOnly}
        />

        <FormControl size="small" sx={{ minWidth: 70 }}>
          <Select
            value={cmpNode.operator}
            onChange={(e) =>
              onChange({ ...cmpNode, operator: e.target.value as ComparisonOperator })
            }
            disabled={isDisabled || readOnly}
          >
            {Object.entries(OPERATOR_SYMBOLS).map(([op, symbol]) => (
              <MenuItem key={op} value={op}>
                {symbol}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <OperandEditor
          value={cmpNode.right}
          onChange={(right) => onChange({ ...cmpNode, right })}
          indicators={indicators}
          showTradeContext={showTradeContext}
          readOnly={readOnly}
        />

        <Box sx={{ flex: 1 }} />

        {!readOnly && (
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={handleToggleDisabled}>
            <ListItemIcon><VisibilityOff fontSize="small" /></ListItemIcon>
            <ListItemText>{isDisabled ? 'Enable' : 'Disable'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleWrapInNot}>
            <ListItemIcon><Block fontSize="small" /></ListItemIcon>
            <ListItemText>Wrap in NOT</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleWrapInIf}>
            <ListItemIcon><CallSplit fontSize="small" /></ListItemIcon>
            <ListItemText>Wrap in IF</ListItemText>
          </MenuItem>
          {onDelete && (
            <>
              <Divider />
              <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Paper>
    );
  }

  // Render CROSSOVER node
  if (isCrossoverNode(node)) {
    const crossNode = node as CrossoverNode;

    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          bgcolor: 'background.paper',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {isDisabled && (
          <Tooltip title="This condition is disabled">
            <VisibilityOff fontSize="small" color="disabled" sx={{ mr: 0.5 }} />
          </Tooltip>
        )}

        <OperandEditor
          value={crossNode.series1}
          onChange={(series1) => onChange({ ...crossNode, series1 })}
          indicators={indicators}
          readOnly={readOnly}
        />

        <Tooltip title="Crosses above">
          <Chip
            icon={<TrendingUp fontSize="small" />}
            label="crosses above"
            size="small"
            color="success"
          />
        </Tooltip>

        <OperandEditor
          value={crossNode.series2}
          onChange={(series2) => onChange({ ...crossNode, series2 })}
          indicators={indicators}
          readOnly={readOnly}
        />

        <Box sx={{ flex: 1 }} />

        {!readOnly && (
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={handleToggleDisabled}>
            <ListItemIcon><VisibilityOff fontSize="small" /></ListItemIcon>
            <ListItemText>{isDisabled ? 'Enable' : 'Disable'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => {
            onChange(createCrossunderNode(crossNode.series1, crossNode.series2));
            setMenuAnchor(null);
          }}>
            <ListItemIcon><SwapHoriz fontSize="small" /></ListItemIcon>
            <ListItemText>Change to Crossunder</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleWrapInNot}>
            <ListItemIcon><Block fontSize="small" /></ListItemIcon>
            <ListItemText>Wrap in NOT</ListItemText>
          </MenuItem>
          {onDelete && (
            <>
              <Divider />
              <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Paper>
    );
  }

  // Render CROSSUNDER node
  if (isCrossunderNode(node)) {
    const crossNode = node as CrossunderNode;

    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          bgcolor: 'background.paper',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {isDisabled && (
          <Tooltip title="This condition is disabled">
            <VisibilityOff fontSize="small" color="disabled" sx={{ mr: 0.5 }} />
          </Tooltip>
        )}

        <OperandEditor
          value={crossNode.series1}
          onChange={(series1) => onChange({ ...crossNode, series1 })}
          indicators={indicators}
          readOnly={readOnly}
        />

        <Tooltip title="Crosses below">
          <Chip
            icon={<TrendingDown fontSize="small" />}
            label="crosses below"
            size="small"
            color="error"
          />
        </Tooltip>

        <OperandEditor
          value={crossNode.series2}
          onChange={(series2) => onChange({ ...crossNode, series2 })}
          indicators={indicators}
          readOnly={readOnly}
        />

        <Box sx={{ flex: 1 }} />

        {!readOnly && (
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={handleToggleDisabled}>
            <ListItemIcon><VisibilityOff fontSize="small" /></ListItemIcon>
            <ListItemText>{isDisabled ? 'Enable' : 'Disable'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => {
            onChange(createCrossoverNode(crossNode.series1, crossNode.series2));
            setMenuAnchor(null);
          }}>
            <ListItemIcon><SwapHoriz fontSize="small" /></ListItemIcon>
            <ListItemText>Change to Crossover</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleWrapInNot}>
            <ListItemIcon><Block fontSize="small" /></ListItemIcon>
            <ListItemText>Wrap in NOT</ListItemText>
          </MenuItem>
          {onDelete && (
            <>
              <Divider />
              <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Paper>
    );
  }

  // Render IF-THEN-ELSE node
  if (isIfThenElseNode(node)) {
    const ifNode = node as IfThenElseNode;

    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderLeft: 3,
          borderLeftColor: isDisabled ? 'grey.400' : 'info.main',
          bgcolor: 'background.default',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: collapsed ? 0 : 1, gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setCollapsed(!collapsed)}
            sx={{ p: 0.5 }}
          >
            {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
          </IconButton>
          <Chip label="IF" size="small" color="info" />
          {isDisabled && (
            <Tooltip title="This condition is disabled">
              <VisibilityOff fontSize="small" color="disabled" />
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          {!readOnly && (
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Collapse in={!collapsed}>
          <Box sx={{ ml: 2, mb: 1 }}>
            <ConditionNodeEditor
              node={ifNode.condition}
              onChange={(condition) => onChange({ ...ifNode, condition })}
              indicators={indicators}
              depth={depth + 1}
              showTradeContext={showTradeContext}
              readOnly={readOnly}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
            <Chip label="THEN" size="small" color="success" />
          </Box>

          <Box sx={{ ml: 2, mb: 1 }}>
            <ConditionNodeEditor
              node={ifNode.then}
              onChange={(then) => onChange({ ...ifNode, then })}
              indicators={indicators}
              depth={depth + 1}
              showTradeContext={showTradeContext}
              readOnly={readOnly}
            />
          </Box>

          {ifNode.else ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                <Chip label="ELSE" size="small" color="warning" />
                {!readOnly && (
                  <IconButton
                    size="small"
                    onClick={() => onChange({ ...ifNode, else: undefined })}
                    disabled={isDisabled}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Box sx={{ ml: 2 }}>
                <ConditionNodeEditor
                  node={ifNode.else}
                  onChange={(elseNode) => onChange({ ...ifNode, else: elseNode })}
                  indicators={indicators}
                  depth={depth + 1}
                  showTradeContext={showTradeContext}
                  readOnly={readOnly}
                />
              </Box>
            </>
          ) : !readOnly && (
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => onChange({ ...ifNode, else: createAndNode([]) })}
              variant="outlined"
              color="warning"
              disabled={isDisabled}
            >
              Add ELSE
            </Button>
          )}
        </Collapse>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={handleToggleDisabled}>
            <ListItemIcon><VisibilityOff fontSize="small" /></ListItemIcon>
            <ListItemText>{isDisabled ? 'Enable' : 'Disable'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { onChange(ifNode.then); setMenuAnchor(null); }}>
            <ListItemIcon><WrapText fontSize="small" /></ListItemIcon>
            <ListItemText>Remove IF (keep THEN)</ListItemText>
          </MenuItem>
          {onDelete && (
            <>
              <Divider />
              <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Paper>
    );
  }

  // Fallback for unknown node types
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Unknown node type: {(node as ConditionNodeType).type}
      </Typography>
    </Paper>
  );
}
