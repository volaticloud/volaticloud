import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { Box, Tabs, Tab, Chip, Paper, Typography } from '@mui/material';
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { useResponsiveLayout } from '../../../hooks';
import type { ResponsivePanelLayoutProps, TabDefinition } from './types';

/**
 * A responsive layout component that renders:
 * - Desktop (>=900px): Resizable panels with internal tabs per group
 * - Mobile (<900px): Flat tabs from all groups combined
 */
export function ResponsivePanelLayout({
  groups,
  orientation = 'horizontal',
  onTabChange,
}: ResponsivePanelLayoutProps) {
  const { isMobile } = useResponsiveLayout();

  // Flatten all tabs for mobile view
  const allTabs = useMemo(() => {
    return groups.flatMap((group) =>
      group.tabs.map((tab) => ({
        ...tab,
        groupId: group.id,
      }))
    );
  }, [groups]);

  // Mobile state - single active tab index
  const [mobileActiveTab, setMobileActiveTab] = useState(0);

  // Desktop state - active tab per group
  const [desktopActiveTabs, setDesktopActiveTabs] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, 0]))
  );

  // Track previous mobile state to detect transitions
  const prevIsMobile = useRef(isMobile);

  // Synchronize tab state when transitioning between mobile/desktop
  useEffect(() => {
    if (prevIsMobile.current !== isMobile) {
      if (isMobile) {
        // Transitioning to mobile: find the flattened index of the first active desktop tab
        // Use the first group's active tab as the mobile selection
        const firstGroup = groups[0];
        if (firstGroup) {
          const activeTabInGroup = desktopActiveTabs[firstGroup.id] ?? 0;
          // Use the first group's active tab index as the mobile selection
          setMobileActiveTab(activeTabInGroup);
        }
      } else {
        // Transitioning to desktop: find which group/tab the mobile selection corresponds to
        const mobileTab = allTabs[mobileActiveTab];
        if (mobileTab) {
          const group = groups.find((g) => g.id === mobileTab.groupId);
          if (group) {
            const tabIndex = group.tabs.findIndex((t) => t.id === mobileTab.id);
            if (tabIndex >= 0) {
              setDesktopActiveTabs((prev) => ({ ...prev, [mobileTab.groupId]: tabIndex }));
            }
          }
        }
      }
      prevIsMobile.current = isMobile;
    }
  }, [isMobile, groups, allTabs, mobileActiveTab, desktopActiveTabs]);

  const handleMobileTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setMobileActiveTab(newValue);
    const tab = allTabs[newValue];
    if (tab) {
      onTabChange?.(tab.groupId, tab.id);
    }
  };

  const handleDesktopTabChange = (groupId: string, newValue: number) => {
    setDesktopActiveTabs((prev) => ({ ...prev, [groupId]: newValue }));
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      const tab = group.tabs[newValue];
      if (tab) {
        onTabChange?.(groupId, tab.id);
      }
    }
  };

  if (isMobile) {
    return <MobileTabs tabs={allTabs} activeTab={mobileActiveTab} onChange={handleMobileTabChange} />;
  }

  return (
    <DesktopPanels
      groups={groups}
      orientation={orientation}
      activeTabs={desktopActiveTabs}
      onTabChange={handleDesktopTabChange}
    />
  );
}

/**
 * Mobile layout - all tabs flattened into a single tab bar
 */
function MobileTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: (TabDefinition & { groupId: string })[];
  activeTab: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={onChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab
              key={`${tab.groupId}-${tab.id}`}
              icon={tab.icon as React.ReactElement | undefined}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {tab.label}
                  {tab.badge !== undefined && (
                    <Chip
                      label={tab.badge}
                      size="small"
                      sx={getBadgeStyles(tab.badgeColor)}
                      color={getBadgeColor(tab.badgeColor)}
                    />
                  )}
                </Box>
              }
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tabs.map((tab, index) => (
          <Box
            key={`${tab.groupId}-${tab.id}`}
            role="tabpanel"
            hidden={activeTab !== index}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'auto',
              p: 2,
              display: activeTab === index ? 'flex' : 'none',
              flexDirection: 'column',
            }}
          >
            {tab.content}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Desktop layout - resizable panels with internal tabs per group
 */
function DesktopPanels({
  groups,
  orientation,
  activeTabs,
  onTabChange,
}: {
  groups: ResponsivePanelLayoutProps['groups'];
  orientation: 'horizontal' | 'vertical';
  activeTabs: Record<string, number>;
  onTabChange: (groupId: string, newValue: number) => void;
}) {
  return (
    <PanelGroup orientation={orientation} style={{ height: '100%', width: '100%' }}>
      {groups.map((group, groupIndex) => (
        <Fragment key={group.id}>
          <Panel
            defaultSize={group.panel?.defaultSize ?? 50}
            minSize={group.panel?.minSize ?? 10}
            maxSize={group.panel?.maxSize}
          >
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Panel Title (optional) */}
              {group.title && (
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {group.title}
                  </Typography>
                </Box>
              )}

              {/* If multiple tabs, show tab bar */}
              {group.tabs.length > 1 && (
                <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={activeTabs[group.id] ?? 0}
                    onChange={(_, v) => onTabChange(group.id, v)}
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    {group.tabs.map((tab) => (
                      <Tab
                        key={tab.id}
                        icon={tab.icon as React.ReactElement | undefined}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {tab.label}
                            {tab.badge !== undefined && (
                              <Chip
                                label={tab.badge}
                                size="small"
                                sx={getBadgeStyles(tab.badgeColor)}
                                color={getBadgeColor(tab.badgeColor)}
                              />
                            )}
                          </Box>
                        }
                        iconPosition="start"
                      />
                    ))}
                  </Tabs>
                </Paper>
              )}

              {/* Tab content */}
              <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                {group.tabs.map((tab, tabIndex) => {
                  const isActive = (activeTabs[group.id] ?? 0) === tabIndex;
                  // For single-tab groups, always show the content
                  const shouldShow = group.tabs.length === 1 || isActive;
                  return (
                    <Box
                      key={tab.id}
                      role="tabpanel"
                      hidden={!shouldShow}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'auto',
                        display: shouldShow ? 'flex' : 'none',
                        flexDirection: 'column',
                      }}
                    >
                      {tab.content}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Panel>

          {/* Add resize handle between panels (not after the last one) */}
          {groupIndex < groups.length - 1 && (
            <PanelResizeHandle
              style={{
                width: orientation === 'horizontal' ? 4 : undefined,
                height: orientation === 'vertical' ? 4 : undefined,
                cursor: orientation === 'horizontal' ? 'col-resize' : 'row-resize',
              }}
            />
          )}
        </Fragment>
      ))}
    </PanelGroup>
  );
}

/**
 * Helper to get badge color for MUI Chip
 */
function getBadgeColor(
  badgeColor?: string
): 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error' | 'default' | undefined {
  if (!badgeColor) return undefined;
  if (['primary', 'secondary', 'info', 'success', 'warning', 'error'].includes(badgeColor)) {
    return badgeColor as 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  }
  return undefined;
}

/**
 * Helper to get custom badge styles for non-MUI colors
 */
function getBadgeStyles(badgeColor?: string) {
  if (!badgeColor) return {};
  if (['primary', 'secondary', 'info', 'success', 'warning', 'error'].includes(badgeColor)) {
    return {};
  }
  // Custom color - use it as background with transparency
  return {
    backgroundColor: `${badgeColor}20`,
    color: badgeColor,
  };
}

export default ResponsivePanelLayout;
