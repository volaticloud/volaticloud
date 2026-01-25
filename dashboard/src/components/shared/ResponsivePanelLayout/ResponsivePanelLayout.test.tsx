import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResponsivePanelLayout } from './ResponsivePanelLayout';
import type { PanelGroupDefinition } from './types';

// Mock the useResponsiveLayout hook
vi.mock('../../../hooks', () => ({
  useResponsiveLayout: vi.fn(() => ({ isMobile: false, showPanels: true })),
}));

// Mock react-resizable-panels since it uses browser-specific features
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Separator: () => <div data-testid="separator" />,
}));

import { useResponsiveLayout } from '../../../hooks';

const mockUseResponsiveLayout = vi.mocked(useResponsiveLayout);

describe('ResponsivePanelLayout', () => {
  const mockOnTabChange = vi.fn();

  const sampleGroups: PanelGroupDefinition[] = [
    {
      id: 'main',
      tabs: [
        { id: 'tab1', label: 'Tab 1', content: <div data-testid="tab1-content">Tab 1 Content</div> },
        { id: 'tab2', label: 'Tab 2', content: <div data-testid="tab2-content">Tab 2 Content</div> },
      ],
      panel: { defaultSize: 70 },
    },
    {
      id: 'sidebar',
      tabs: [
        { id: 'settings', label: 'Settings', content: <div data-testid="settings-content">Settings</div> },
      ],
      panel: { defaultSize: 30 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResponsiveLayout.mockReturnValue({ isMobile: false, showPanels: true });
  });

  describe('desktop mode', () => {
    it('renders panels with tabs on desktop', () => {
      render(<ResponsivePanelLayout groups={sampleGroups} />);

      // Should show tabs for the multi-tab group
      expect(screen.getByRole('tab', { name: /tab 1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tab 2/i })).toBeInTheDocument();
    });

    it('shows first tab content by default', () => {
      render(<ResponsivePanelLayout groups={sampleGroups} />);

      expect(screen.getByTestId('tab1-content')).toBeInTheDocument();
    });

    it('switches tab content on click', async () => {
      const user = userEvent.setup();
      render(<ResponsivePanelLayout groups={sampleGroups} onTabChange={mockOnTabChange} />);

      // Click the second tab
      await user.click(screen.getByRole('tab', { name: /tab 2/i }));

      expect(screen.getByTestId('tab2-content')).toBeVisible();
      expect(mockOnTabChange).toHaveBeenCalledWith('main', 'tab2');
    });

    it('renders single-tab groups without tab bar', () => {
      render(<ResponsivePanelLayout groups={sampleGroups} />);

      // Settings is a single tab, so it should show content directly without a tab bar
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      // But there shouldn't be a "Settings" tab button in the sidebar panel
      expect(screen.queryAllByRole('tab', { name: /settings/i })).toHaveLength(0);
    });
  });

  describe('mobile mode', () => {
    beforeEach(() => {
      mockUseResponsiveLayout.mockReturnValue({ isMobile: true, showPanels: false });
    });

    it('renders all tabs flattened on mobile', () => {
      render(<ResponsivePanelLayout groups={sampleGroups} />);

      // All tabs should be in one tab bar
      expect(screen.getByRole('tab', { name: /tab 1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tab 2/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
    });

    it('shows first tab content by default on mobile', () => {
      render(<ResponsivePanelLayout groups={sampleGroups} />);

      expect(screen.getByTestId('tab1-content')).toBeVisible();
    });

    it('switches tab content on mobile', async () => {
      const user = userEvent.setup();
      render(<ResponsivePanelLayout groups={sampleGroups} onTabChange={mockOnTabChange} />);

      // Click settings tab
      await user.click(screen.getByRole('tab', { name: /settings/i }));

      expect(screen.getByTestId('settings-content')).toBeVisible();
      expect(mockOnTabChange).toHaveBeenCalledWith('sidebar', 'settings');
    });
  });

  describe('badges', () => {
    it('renders badge on tab when provided', () => {
      // Need multiple tabs to show tab bar on desktop
      const groupsWithBadge: PanelGroupDefinition[] = [
        {
          id: 'main',
          tabs: [
            { id: 'tab1', label: 'Tab 1', badge: 5, content: <div>Content 1</div> },
            { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
          ],
        },
      ];

      render(<ResponsivePanelLayout groups={groupsWithBadge} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders colored badge when badgeColor is provided', () => {
      const groupsWithColoredBadge: PanelGroupDefinition[] = [
        {
          id: 'main',
          tabs: [
            { id: 'tab1', label: 'Tab 1', badge: 3, badgeColor: 'error', content: <div>Content 1</div> },
            { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
          ],
        },
      ];

      render(<ResponsivePanelLayout groups={groupsWithColoredBadge} />);

      // getByText returns the label span, so we need to find the parent Chip
      const badgeLabel = screen.getByText('3');
      const chip = badgeLabel.closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorError');
    });
  });

  describe('icons', () => {
    it('renders icon on tab when provided', () => {
      // Need multiple tabs to show tab bar on desktop
      const groupsWithIcon: PanelGroupDefinition[] = [
        {
          id: 'main',
          tabs: [
            {
              id: 'tab1',
              label: 'Tab 1',
              icon: <span data-testid="custom-icon">Icon</span>,
              content: <div>Content 1</div>,
            },
            { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
          ],
        },
      ];

      render(<ResponsivePanelLayout groups={groupsWithIcon} />);

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('panel titles', () => {
    it('renders panel title when provided', () => {
      mockUseResponsiveLayout.mockReturnValue({ isMobile: false, showPanels: true });

      const groupsWithTitle: PanelGroupDefinition[] = [
        {
          id: 'main',
          title: 'Main Panel',
          tabs: [
            { id: 'tab1', label: 'Tab 1', content: <div>Content</div> },
          ],
        },
      ];

      render(<ResponsivePanelLayout groups={groupsWithTitle} />);

      expect(screen.getByText('Main Panel')).toBeInTheDocument();
    });
  });
});
