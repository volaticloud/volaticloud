import { ReactNode } from 'react';

/**
 * Definition for a single tab within a panel group.
 */
export interface TabDefinition {
  /** Unique identifier for this tab */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Optional icon to display next to the label */
  icon?: ReactNode;
  /** Optional badge count to display */
  badge?: number;
  /** Badge color - MUI color name or CSS color string */
  badgeColor?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error' | string;
  /** The content to render when this tab is active */
  content: ReactNode;
}

/**
 * Definition for a panel group containing one or more tabs.
 * On desktop: renders as a resizable panel with internal tabs (if multiple tabs).
 * On mobile: all tabs are flattened into a single tab bar.
 */
export interface PanelGroupDefinition {
  /** Unique identifier for this panel group */
  id: string;
  /** Optional title shown above the panel (desktop only) */
  title?: string;
  /** Tabs within this panel group */
  tabs: TabDefinition[];
  /** Panel sizing configuration (desktop only) */
  panel?: {
    /** Default size as a percentage (e.g., "75" for 75%) */
    defaultSize?: number;
    /** Minimum size as a percentage */
    minSize?: number;
    /** Maximum size as a percentage */
    maxSize?: number;
  };
}

/**
 * Props for the ResponsivePanelLayout component.
 */
export interface ResponsivePanelLayoutProps {
  /** Panel groups to render - on desktop as resizable panels, on mobile as flat tabs */
  groups: PanelGroupDefinition[];
  /** Panel orientation for desktop layout */
  orientation?: 'horizontal' | 'vertical';
  /** Callback when the active tab changes */
  onTabChange?: (groupId: string, tabId: string) => void;
}
