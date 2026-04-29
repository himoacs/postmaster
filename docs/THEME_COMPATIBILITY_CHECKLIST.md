# Theme Compatibility Checklist

Use this checklist when creating new components or reviewing existing ones to ensure proper light/dark theme support.

## Core Requirements

### ✅ Color Usage
- [ ] **No hardcoded hex colors** - Use CSS variables instead (e.g., `var(--background)`, `var(--foreground)`)
- [ ] **No hardcoded Tailwind colors** - Avoid `bg-white`, `bg-black`, `text-white`, `text-black` unless absolutely necessary
- [ ] **Use semantic color tokens** - Use `bg-background`, `text-foreground`, `border-border`, etc.
- [ ] **Overlay colors are theme-aware** - Use `bg-background/80` instead of `bg-black/10` for modal overlays
- [ ] **Chart colors adapt** - Use CSS variables `--chart-1` through `--chart-5` for data visualization

### ✅ Component Styling
- [ ] **No explicit dark: classes** - Avoid hardcoding `dark:bg-gray-800`, instead use theme variables that automatically adapt
- [ ] **Proper contrast in both themes** - Text is readable against backgrounds in light and dark modes (test with WCAG contrast checker)
- [ ] **Icons adapt to theme** - Use `currentColor` or theme-aware stroke/fill colors
- [ ] **Focus indicators are visible** - Focus rings work in both themes (use `outline-ring` utility)
- [ ] **Borders are subtle** - Use `border-border` which provides appropriate contrast in both themes

### ✅ Interactive States
- [ ] **Hover states work in both themes** - Test hover effects in light and dark modes
- [ ] **Active/selected states are clear** - Selected items are distinguishable in both themes
- [ ] **Disabled states are apparent** - Disabled elements look disabled in both themes (proper opacity/muted colors)
- [ ] **Loading states are visible** - Spinners, skeletons, and progress indicators work in both themes

## Testing Checklist

### Visual Testing
- [ ] **Test component in light theme** - Verify all text is readable, borders are visible
- [ ] **Test component in dark theme** - Verify all text is readable, borders are visible  
- [ ] **Test theme switching** - Component updates immediately when theme changes (no flash of unstyled content)
- [ ] **Test system theme detection** - Respects OS light/dark mode setting on first load
- [ ] **Test in different browsers** - Chrome, Safari, Firefox all render themes correctly

### Accessibility Testing
- [ ] **Color contrast passes WCAG AA** - Use browser DevTools or online contrast checker
- [ ] **Text is readable** - Body text has 4.5:1 contrast ratio minimum
- [ ] **UI elements are visible** - Buttons, borders, icons have 3:1 contrast minimum
- [ ] **Focus indicators are clear** - Keyboard navigation shows visible focus in both themes
- [ ] **No information conveyed by color alone** - Use icons, labels, or patterns in addition to color

### Functional Testing
- [ ] **Toast notifications are readable** - Sonner toasts inherit theme correctly
- [ ] **Modals/dialogs work in both themes** - Overlays, content, and close buttons are visible
- [ ] **Dropdown menus render correctly** - Menu backgrounds, text, and hover states work
- [ ] **Forms are usable** - Inputs, labels, error messages are readable in both themes
- [ ] **Tables/lists are scannable** - Rows, cells, and dividers provide proper visual separation

## Component Categories

### High Priority (User-Facing Core)
These components must be thoroughly tested as they're critical to user experience:
- [ ] Buttons (all variants)
- [ ] Inputs & textareas
- [ ] Dialogs & modals
- [ ] Dropdown menus
- [ ] Toast notifications
- [ ] Cards
- [ ] Alerts & badges

### Medium Priority (Feature Components)
Feature-specific components that users interact with frequently:
- [ ] Editor workspace
- [ ] Comparison view
- [ ] History list/detail
- [ ] Knowledge base UI
- [ ] Settings panels
- [ ] Profile editor

### Standard Priority (Layout & Navigation)
Layout components that provide structure:
- [ ] Page layouts
- [ ] Sidebars
- [ ] Headers/footers
- [ ] Navigation menus
- [ ] Tabs
- [ ] Separators

## Common Pitfalls to Avoid

### ❌ DON'T Do This
```tsx
// Hardcoded colors
<div className="bg-white dark:bg-gray-800 text-black dark:text-white">

// Hardcoded hex values
<div style={{ backgroundColor: '#ffffff', color: '#000000' }}>

// Non-semantic Tailwind colors
<div className="bg-blue-500 text-gray-700">

// Black overlay that's too dark in light theme
<div className="bg-black/50">
```

### ✅ DO This Instead
```tsx
// Theme-aware semantic colors
<div className="bg-background text-foreground">

// CSS variables
<div style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>

// Semantic Tailwind utilities
<div className="bg-primary text-primary-foreground">

// Theme-aware overlay
<div className="bg-background/80 backdrop-blur-sm">
```

## Editorial Theme Specific Notes

### Color Palette
- **Primary accent**: Terracotta (warm orange-brown)
  - Light: `oklch(0.52 0.14 35)`
  - Dark: `oklch(0.65 0.15 35)`
- **Background**: Warm paper tones (light) / warm charcoal (dark)
- **Text**: Deep charcoal (light) / off-white (dark)

### Design Principles
- Warm, comfortable reading experience in both themes
- Paper-inspired backgrounds in light mode
- No harsh pure black or pure white
- Subtle borders using warm tones
- Consistent terracotta accent for interactive elements

## Integration with next-themes

### Provider Setup
```tsx
// In root layout.tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange={false}
>
  {children}
</ThemeProvider>
```

### Using Theme in Components
```tsx
"use client";

import { useTheme } from "next-themes";

export function MyComponent() {
  const { theme, setTheme } = useTheme();
  // Component logic
}
```

### Avoiding Hydration Mismatches
```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) {
  return <Skeleton />; // Return loading state
}
```

## Resources

- **WCAG Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Tailwind Dark Mode Docs**: https://tailwindcss.com/docs/dark-mode
- **next-themes Documentation**: https://github.com/pacocoursey/next-themes
- **OKLCH Color Picker**: https://oklch.com/
- **shadcn/ui Theming Guide**: https://ui.shadcn.com/docs/theming

## Review Process

When reviewing a PR that adds new UI components:

1. **Check for hardcoded colors** - Search for hex codes, rgb(), or explicit dark: classes
2. **Test theme switching** - Manually toggle between light/dark in the settings
3. **Check contrast** - Run automated contrast checks or use browser DevTools
4. **Review overlays** - Ensure modals/dialogs/tooltips work in both themes
5. **Verify animations** - Theme transitions should be smooth (but respect prefers-reduced-motion)

## Maintenance

- **Update this checklist** when adding new theme features or discovering new patterns
- **Run periodic audits** - Quarterly review of all components for theme compliance
- **Document exceptions** - If a component legitimately needs hardcoded colors, document why
- **Share learnings** - When you fix a theme bug, add the pattern to this document

---

**Last Updated**: April 29, 2026  
**Version**: 1.0  
**Maintainer**: PostMaster Team
