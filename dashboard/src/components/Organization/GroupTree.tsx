import { useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Typography,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Folder,
  FolderOpen,
  Group as GroupIcon,
} from '@mui/icons-material';
import { OrganizationGroupTreeQuery } from './organization.generated';

type GroupNode = NonNullable<OrganizationGroupTreeQuery['organizationGroupTree']>;

interface GroupTreeProps {
  tree: GroupNode;
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string, groupName: string) => void;
}

interface TreeNodeProps {
  node: GroupNode;
  level: number;
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string, groupName: string) => void;
}

const TreeNode = ({ node, level, selectedGroupId, onGroupSelect }: TreeNodeProps) => {
  const [open, setOpen] = useState(true);
  const isRole = node.type === 'role';
  const isSelected = selectedGroupId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    // Select this group (use title for display, name for technical reference)
    onGroupSelect(node.id, node.title);

    // Also toggle expand/collapse for groups with children
    if (hasChildren) {
      setOpen(!open);
    }
  };

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        sx={{
          pl: level * 2 + 2,
          backgroundColor: isSelected ? 'action.selected' : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Icon */}
          <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
            {isRole ? (
              <GroupIcon fontSize="small" color={isSelected ? 'primary' : 'action'} />
            ) : hasChildren ? (
              open ? (
                <FolderOpen fontSize="small" color={isSelected ? 'primary' : 'action'} />
              ) : (
                <Folder fontSize="small" color={isSelected ? 'primary' : 'action'} />
              )
            ) : (
              <Folder fontSize="small" color={isSelected ? 'primary' : 'action'} />
            )}
          </Box>

          {/* Title */}
          <ListItemText
            primary={node.title}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: isSelected ? 600 : 400,
            }}
          />

          {/* Expand/Collapse icon for groups with children */}
          {hasChildren && (open ? <ExpandLess /> : <ExpandMore />)}
        </Box>
      </ListItemButton>

      {/* Render children */}
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {node.children!.map((child) => (
              <TreeNode
                key={child.id}
                node={child as GroupNode}
                level={level + 1}
                selectedGroupId={selectedGroupId}
                onGroupSelect={onGroupSelect}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export const GroupTree = ({ tree, selectedGroupId, onGroupSelect }: GroupTreeProps) => {
  return (
    <Box sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 1 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Group Hierarchy
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Click on any group to view its members
        </Typography>
      </Box>
      <List component="nav" sx={{ py: 1 }}>
        <TreeNode node={tree} level={0} selectedGroupId={selectedGroupId} onGroupSelect={onGroupSelect} />
      </List>
    </Box>
  );
};