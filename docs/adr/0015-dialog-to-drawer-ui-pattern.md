# ADR-0015: Dialog to Drawer UI Pattern

Date: 2026-01-23

## Status

Accepted

## Context

The dashboard previously used Material-UI Dialog components (modal overlays) for all form interactions including:

- Creating/editing resources (bots, strategies, exchanges, runners)
- Confirmation dialogs (delete operations)
- Detail views (alert details, backtest results)
- User management (invitations, role changes)

Modal dialogs have several UX limitations:

1. **Context loss**: Modals obscure the underlying page, making it harder to reference existing data
2. **Mobile unfriendliness**: Fixed-position modals can be problematic on mobile devices
3. **Inconsistent sizing**: Different dialogs had varying widths without clear guidelines
4. **Animation jarring**: Center-screen pop-ups can feel abrupt

## Decision

Replace all Dialog components with Drawer components that slide in from the right side of the screen.

### Design Specifications

1. **Anchor Position**: All drawers use `anchor="right"`
2. **Width Strategy**: Responsive widths using `{ xs: '100%', sm: <width> }`
   - Small forms (confirmations): 400px
   - Standard forms (bots, exchanges): 480-500px
   - Complex forms (runners, strategies): 600px
   - Full-width views (FreqUI): 95vw
3. **Structure**: Consistent three-part layout
   - Header: Title + close button with `Divider`
   - Content: Scrollable form area with `px: 3, py: 2` padding
   - Footer: Action buttons with `Divider`
4. **Shared Components**:
   - `FormDrawer`: Reusable wrapper with loading states, colors, and common props
   - `ConfirmDrawer`: Wrapper for destructive action confirmations
   - `UnsavedChangesDrawer`: Handles unsaved changes warnings

### Components Changed

| Category | Components |
|----------|------------|
| Alerts | AlertDetailDrawer, AlertRuleDrawer |
| Backtests | BacktestResultsDrawer, CreateBacktestDrawer, DeleteBacktestDrawer |
| Bots | CreateBotDrawer, EditBotDrawer, DeleteBotDrawer, FreqUIDrawer |
| Exchanges | CreateExchangeDrawer, EditExchangeDrawer, DeleteExchangeDrawer |
| Organization | CreateOrganizationDrawer, InviteUserDrawer, ChangeRoleDrawer |
| Runners | CreateRunnerDrawer, EditRunnerDrawer, DeleteRunnerDrawer |
| Strategies | CreateStrategyDrawer, DeleteStrategyDrawer |
| Shared | FormDrawer, ConfirmDrawer, UnsavedChangesDrawer, VisibilityToggleDrawer |

### Exceptions

The following components intentionally retain Dialog usage:

- **VersionHistoryPanel** (`dashboard/src/components/Strategies/VersionHistoryPanel.tsx`): Uses a full-screen Dialog (`maxWidth="xl"`, `fullWidth`, `90vh` height) for side-by-side code diff comparison using Monaco DiffEditor. A drawer is not suitable here because:
  - Side-by-side diff views require maximum horizontal space
  - The diff editor needs near-full-screen real estate for effective code comparison
  - This is a temporary overlay for viewing differences, not a form workflow

- **StrategyStudio Leave Confirmation** (`dashboard/src/components/Strategies/StrategyStudio.tsx`): Uses Dialog for the unsaved changes navigation guard with 3-button UI (Cancel, Discard Changes, Save & Leave). This is provided by `useUnsavedChangesGuard` hook and requires center-positioned modal with specialized 3-action workflow that doesn't fit the standard drawer confirmation pattern

## Consequences

### Positive

1. **Better Context**: Users can see the underlying page content alongside the form
2. **Consistent UX**: All interactions follow the same slide-in pattern
3. **Mobile Friendly**: Full-width on mobile, fixed width on desktop
4. **Smoother Animations**: Slide-in feels more natural than pop-up
5. **Accessibility**: Proper ARIA labels and focus management maintained

### Negative

1. **Horizontal Space**: Drawers consume horizontal space instead of overlaying
2. **Learning Curve**: Users accustomed to modals may need adjustment
3. **Content Always Rendered**: Drawers render content when closed (can be optimized with conditional rendering for complex drawers)

### Neutral

1. **Same Functionality**: All form validation, loading states, and error handling preserved
2. **Test Coverage**: All 241 tests updated and passing

## Alternatives Considered

1. **Keep Dialogs**: Rejected due to UX limitations on mobile and context loss
2. **Full-Page Views**: Rejected as too disruptive for simple forms
3. **Left-Side Drawers**: Rejected as right-side feels more natural for forms (left is navigation)
4. **Bottom Sheets**: Rejected as they work better for mobile-only applications

## References

- Material-UI Drawer: https://mui.com/material-ui/react-drawer/
- PR #142: Initial implementation
