import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  History,
  Close,
  CompareArrows,
  ContentCopy,
  Check,
} from '@mui/icons-material';
import { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useGetStrategyVersionsForStudioQuery } from './strategy-studio.generated';

interface StrategyVersion {
  id: string;
  name: string;
  versionNumber: number;
  isLatest: boolean;
  code: string;
  createdAt: string;
}

interface VersionHistoryPanelProps {
  strategyName: string;
  currentCode: string;
  currentVersionNumber: number;
  onCopyFromVersion: (code: string) => void;
}

export const VersionHistoryPanel = ({
  strategyName,
  currentCode,
  currentVersionNumber,
  onCopyFromVersion,
}: VersionHistoryPanelProps) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [selectedVersion, setSelectedVersion] = useState<StrategyVersion | null>(null);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [modifiedCode, setModifiedCode] = useState(currentCode);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  const { data, loading, error } = useGetStrategyVersionsForStudioQuery({
    variables: { name: strategyName },
    skip: !strategyName,
  });

  const versions = data?.strategyVersions || [];

  const handleVersionClick = (version: StrategyVersion) => {
    setSelectedVersion(version);
    setModifiedCode(currentCode);
    setDiffDialogOpen(true);
  };

  const handleCopyFullCode = () => {
    if (selectedVersion) {
      onCopyFromVersion(selectedVersion.code);
      setDiffDialogOpen(false);
    }
  };

  const handleApplyChanges = () => {
    onCopyFromVersion(modifiedCode);
    setDiffDialogOpen(false);
  };

  const handleDiffEditorMount = (diffEditor: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = diffEditor;
    const modifiedEditor = diffEditor.getModifiedEditor();
    modifiedEditor.onDidChangeModelContent(() => {
      setModifiedCode(modifiedEditor.getValue());
    });
  };

  const hasChangesInDiff = modifiedCode !== currentCode;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        Error loading versions
      </Alert>
    );
  }

  if (versions.length <= 1) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No previous versions available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History fontSize="small" />
          <Typography variant="subtitle2">Version History</Typography>
          <Chip label={versions.length} size="small" />
        </Box>
      </Box>

      <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
        {[...versions].reverse().map((version) => (
          <ListItemButton
            key={version.id}
            onClick={() => handleVersionClick(version)}
            disabled={version.versionNumber === currentVersionNumber}
            sx={{
              opacity: version.versionNumber === currentVersionNumber ? 0.5 : 1,
            }}
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    v{version.versionNumber}
                  </Typography>
                  {version.isLatest && (
                    <Chip label="Latest" size="small" color="success" sx={{ height: 18 }} />
                  )}
                  {version.versionNumber === currentVersionNumber && (
                    <Chip label="Current" size="small" color="primary" sx={{ height: 18 }} />
                  )}
                </Box>
              }
              secondary={formatDate(version.createdAt)}
            />
            {version.versionNumber !== currentVersionNumber && (
              <Tooltip title="Compare with current">
                <CompareArrows fontSize="small" color="action" />
              </Tooltip>
            )}
          </ListItemButton>
        ))}
      </List>

      <Dialog
        open={diffDialogOpen}
        onClose={() => setDiffDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CompareArrows />
              <Typography variant="h6">
                Compare: v{selectedVersion?.versionNumber} vs Current (v{currentVersionNumber})
              </Typography>
            </Box>
            <IconButton onClick={() => setDiffDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" color="text.secondary">
                v{selectedVersion?.versionNumber} (Historical)
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Current (v{currentVersionNumber})
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            <DiffEditor
              height="100%"
              language="python"
              original={selectedVersion?.code || ''}
              modified={modifiedCode}
              theme={isDarkMode ? 'vs-dark' : 'light'}
              onMount={handleDiffEditorMount}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderSideBySide: true,
                originalEditable: false,
                enableSplitViewResizing: true,
              }}
            />
          </Box>

          <Alert severity="info" sx={{ mx: 2, mb: 1 }}>
            Edit the right side to selectively merge changes. Click in the gutter between editors to copy individual changes.
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDiffDialogOpen(false)}>Close</Button>
          <Button
            startIcon={<ContentCopy />}
            onClick={handleCopyFullCode}
          >
            Replace All with v{selectedVersion?.versionNumber}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<Check />}
            onClick={handleApplyChanges}
            disabled={!hasChangesInDiff}
          >
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};