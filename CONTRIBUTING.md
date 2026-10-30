# Contributing to GhostPay

Thank you for your interest in contributing to GhostPay. We welcome contributions from the community to help build private, shielded payment infrastructure.

Please take a moment to review this document before submitting contributions.

---

## Code of Conduct

We are committed to providing a welcoming, respectful, and harassment-free environment for all contributors. Please be considerate, professional, and collaborative in all communications and pull requests.

---

## Development Workflow

### 1. Prerequisites
- Node.js (v18 or later recommended)
- pnpm or npm
- Supabase CLI (for local database migrations and type generation)

### 2. Getting Started
1. Fork the repository and clone your fork locally:
   ```bash
   git clone https://github.com/your-username/ghostpay.git
   cd ghostpay
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env` and configure your local Supabase credentials:
     ```bash
     cp .env.example .env
     ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Branching & Commits
- Create feature or fix branches branched off `main`:
  ```bash
  git checkout -b feat/your-feature-name
  # or
  git checkout -b fix/issue-description
  ```
- Use Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Keep pull requests focused on a single change or cohesive feature.

---

## Coding Standards & Conventions

### TypeScript & Strict Typing
- GhostPay enforces strict TypeScript compiler options (`noUnusedLocals: true`, `noUnusedParameters: true`).
- Ensure all types are explicitly defined. Avoid `any` types; prefer strict interfaces and utility types.
- Type imports should use explicit `import type { ... }` syntax.

### Component Architecture
- React components must follow `PascalCase.tsx` naming conventions and be placed inside `src/components/` or `src/pages/`.
- Utility functions and helpers must follow `camelCase.ts` and reside in `src/lib/`.
- Keep Next.js App Router reserved files intact (`page.tsx`, `layout.tsx`, `route.ts`).
- Imports at the top of files should be cleanly grouped and alphabetized:
  1. React core and hooks
  2. Third-party packages
  3. Local components and utilities
  4. TypeScript types

---

## UI Architecture & Styling Guidelines

To maintain design system consistency, modifications to `GhostPayModalKit.tsx`, `ghostpay-modal.css`, and `ghostpay-modal.lock.css` require approval from the lead maintainer. Do not apply inline styles.

- **Component Primitives**: Modals and interaction dialogs must strictly use established primitives:
  - `GPModal`: Standard backdrop, panel container, header, and close controls.
  - `GPAmountField`: Formatted rupee currency input with numeric safety.
  - `GPChips`: Predefined quick-select additive and absolute chips.
  - `GPButton`: Primary and secondary action triggers.
- **Styling Discipline**: Do not restyle modals with inline styles, new ad-hoc classes, or overriding Tailwind utilities.
- **Global CSS Safeguards**: Do not add global `input`, `button`, or `chip` selectors that could bleed into or alter `.gp-panel` layouts and typography.
- **Numeric Formatting**: Use `font-variant-numeric: tabular-nums` for all balances, transaction amounts, and reference codes.
- **Tone & Typography**: Maintain clean fintech typography. Avoid excessive decorative ornamentation or unapproved symbols.

---

## Submitting Pull Requests

1. **Verify Builds Locally**:
   - Run type checks and build verification before opening a pull request:
     ```bash
     npm run build
     ```
2. **Open a Pull Request**:
   - Provide a clear title and description explaining the changes and testing steps.
   - Link any relevant issues being addressed.
3. **Review Process**:
   - Maintainers will review your pull request for code quality, adherence to design system guidelines, and test coverage.
