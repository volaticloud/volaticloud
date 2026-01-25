# ADR-0016: Responsive Panel Layout System

Date: 2026-01-25

## Status

Accepted

## Context

The Strategy Studio required a layout system that works well across different screen sizes:

- **Desktop**: Users expect resizable panels to arrange their workspace (code/builder on the left, settings on the right)
- **Mobile**: Limited horizontal space makes multi-column layouts impractical; tabs are the preferred navigation pattern

The existing implementation used `react-resizable-panels` directly in StrategyStudio, but:

1. Had no responsive behavior for mobile devices
2. Required duplicating panel configuration across components
3. Mixed layout concerns with business logic
4. Had no reusable pattern for other areas of the application

## Decision

Create a unified `ResponsivePanelLayout` component that:

1. **Automatically switches** between panels (desktop) and tabs (mobile) based on screen size
2. **Uses MUI breakpoints** with the 900px (`md`) threshold
3. **Preserves user context** when transitioning between modes
4. **Provides accessibility** with proper ARIA attributes

### Architecture

```
hooks/
  useResponsiveLayout.ts         # Screen size detection hook

components/shared/
  ResponsivePanelLayout/
    index.ts
    types.ts                     # TabDefinition, PanelGroupDefinition
    ResponsivePanelLayout.tsx    # Main orchestrator component
```

### Design Decisions

#### 1. Breakpoint: 900px (md)

Chosen because:
- MUI's default `md` breakpoint aligns with tablet portrait mode
- Below 900px, two-column layouts become cramped
- Above 900px, panels have enough space to be useful

#### 2. Library: react-resizable-panels

Chosen over alternatives for:
- **Minimal bundle size**: ~8KB gzipped
- **Accessibility built-in**: Keyboard navigation for resize handles
- **React 18 support**: Works with concurrent features
- **Flexible API**: Supports horizontal/vertical orientation, persistence

Alternatives considered:
- **Custom CSS Grid/Flexbox**: More code, no resize handles, accessibility burden
- **react-split-pane**: Larger bundle, less maintained
- **allotment**: Good option but react-resizable-panels has better TypeScript support

#### 3. State Synchronization Strategy

When transitioning between mobile and desktop:
- **Mobile → Desktop**: The selected mobile tab maps to its group/tab position
- **Desktop → Mobile**: The first group's active tab becomes the mobile selection

This approach preserves the most recent user intent without complex state management.

#### 4. Tab Content Rendering

All tab content is mounted but hidden (CSS `display: none`) rather than unmounted. This:
- Preserves form state when switching tabs
- Avoids re-mount costs for complex components
- Trades memory for UX smoothness

### API

```typescript
interface TabDefinition {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
  badgeColor?: string;
  content: ReactNode;
}

interface PanelGroupDefinition {
  id: string;
  title?: string;
  tabs: TabDefinition[];
  panel?: {
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  };
}

interface ResponsivePanelLayoutProps {
  groups: PanelGroupDefinition[];
  orientation?: 'horizontal' | 'vertical';
  onTabChange?: (groupId: string, tabId: string) => void;
}
```

### Usage Example

```tsx
const groups: PanelGroupDefinition[] = [
  {
    id: 'builder',
    tabs: [
      { id: 'indicators', label: 'Indicators', icon: <ShowChart />, content: <IndicatorSelector /> },
      { id: 'signals', label: 'Signals', icon: <Timeline />, content: <SignalEditor /> },
    ],
    panel: { defaultSize: 75, minSize: 30 },
  },
  {
    id: 'settings',
    title: 'Strategy Settings',
    tabs: [{ id: 'settings', label: 'Settings', content: <SettingsPanel /> }],
    panel: { defaultSize: 25, minSize: 15 },
  },
];

<ResponsivePanelLayout groups={groups} onTabChange={handleTabChange} />
```

## Consequences

### Positive

1. **Consistent responsive behavior** across the application
2. **Reusable pattern** for any multi-panel layout
3. **Automatic accessibility** with ARIA labels and keyboard navigation
4. **State preservation** across breakpoint transitions
5. **Testable** with comprehensive unit tests

### Negative

1. **Memory overhead**: All tabs mounted simultaneously
2. **Initial complexity**: Understanding the group/tab abstraction
3. **Limited to two modes**: No intermediate breakpoint behaviors

### Neutral

1. **Bundle size increase**: ~8KB for react-resizable-panels (acceptable for the value)
2. **Learning curve**: Developers need to understand the group/tab model

## Implementation

### Key Files

- `dashboard/src/hooks/useResponsiveLayout.ts` - Screen size detection hook
- `dashboard/src/components/shared/ResponsivePanelLayout/ResponsivePanelLayout.tsx` - Main component
- `dashboard/src/components/shared/ResponsivePanelLayout/types.ts` - Type definitions
- `dashboard/src/components/Strategies/StrategyStudio.tsx` - Primary consumer

### Hook Implementation

```typescript
import { useTheme, useMediaQuery } from '@mui/material';

export function useResponsiveLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px

  return {
    isMobile,
    showPanels: !isMobile,
  };
}
```

## Validation

1. **Type check**: `npx tsc --noEmit` passes
2. **Tests**: Unit tests cover desktop/mobile modes, tab switching, badges
3. **Manual testing**: Verify at 900px breakpoint in browser DevTools
4. **Accessibility**: Screen reader announces tab changes correctly

## References

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [MUI Breakpoints](https://mui.com/material-ui/customization/breakpoints/)
- [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [ADR-0015](0015-dialog-to-drawer-ui-pattern.md) - Related UI pattern decision
