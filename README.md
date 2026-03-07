# Farmstand Experimental

A garden data logging app for tracking seeds, slots, and activities across buckets, trays, raised beds, and seed bins.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Hosting)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Firestore, Authentication (Google sign-in), and Hosting
   - Copy `.env.example` to `.env.local` and fill in your Firebase config
   - Create a Firestore document at `config/allowedUsers` with field `emails` (array of allowed email addresses)

3. **Run locally**

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npm run lint` — Run OxLint
- `npm run format` — Format with Prettier
- `npm run typecheck` — TypeScript check

## Quality Gates

Before submitting changes:

1. `npm run format`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
