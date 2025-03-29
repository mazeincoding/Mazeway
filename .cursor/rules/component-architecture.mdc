---
description: 
globs: 
alwaysApply: true
---
# component-architecture

### Component Structure & Dependencies
- MUST: Structure form components hierarchically with `AuthForm` as parent and specialized validation components as children
- AVOID: Direct API calls in form components - use hooks for data fetching/mutations
- WHY: Separates form UI from business logic, enables reuse of validation patterns
- EXAMPLE: `src/components/auth-form.tsx` coordinates child components like `2fa-methods.tsx`

### Authentication Flow Components 
- MUST: Use hook-based state management for auth flows (login, signup, 2FA)
- AVOID: Mixing auth state across components, keeping auth logic in UI components
- WHY: Centralizes auth state management, simplifies testing
- EXAMPLE: `src/components/user-provider.tsx` handles global auth state

### Form Validation
- MUST: Implement field-level validation using `useFormField` hook pattern
- AVOID: Custom validation logic inside form components
- WHY: Consistent validation behaviors across forms
- EXAMPLE: `src/components/ui/form.tsx` FormFieldContext pattern

### Toast Notifications
- MUST: Use centralized toast system via `useToast` hook for all user feedback
- AVOID: Multiple toast implementations or direct toast calls
- WHY: Consistent notification styling and behavior
- EXAMPLE: `src/components/ui/toast.tsx` provides toast primitives

### Data Loading States
- MUST: Implement skeleton loading components during data fetches
- AVOID: Showing empty states or spinners
- WHY: Provides visual continuity during loading
- EXAMPLE: `src/components/ui/skeleton.tsx` skeleton components

### Device Session Management
- MUST: Use `DeviceSessionsList` component for managing active sessions
- AVOID: Direct session manipulation outside session components
- WHY: Centralizes session management UI/logic
- EXAMPLE: `src/components/device-sessions-list.tsx`

### Two-Factor Authentication
- MUST: Use `2FASetupDialog` for all 2FA enrollment flows
- AVOID: Custom 2FA setup implementations
- WHY: Consistent 2FA setup experience
- EXAMPLE: `src/components/2fa-setup-dialog.tsx`

### Export Data Workflow
- MUST: Use `DataExport` component for handling user data exports
- AVOID: Custom export implementations
- WHY: Standardizes export process and UI
- EXAMPLE: `src/components/data-export.tsx`

### Account Management
- MUST: Use `DeleteAccount` component for account deletion flows
- AVOID: Custom deletion implementations
- WHY: Ensures proper verification and cleanup
- EXAMPLE: `src/components/delete-account.tsx`

### Social Provider Integration
- MUST: Use `SocialProviders` component for OAuth integration
- AVOID: Direct OAuth provider implementation
- WHY: Centralizes social auth handling
- EXAMPLE: `src/components/social-providers.tsx`

$END$