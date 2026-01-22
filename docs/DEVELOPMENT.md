# Development Guide

## Prerequisites

- Node.js 18+
- PHP 7.4+ with GD extension
- MySQL 8.0+

## Environment Setup

### 1. Install Dependencies

```bash
cd qve
npm install
```

### 2. Configure Database

Database credentials are stored outside the repo at `../wineapp-config/config.local.php`:

```php
<?php
return [
    'host' => '10.0.0.16',
    'dbname' => 'winelist',
    'username' => 'your_user',
    'password' => 'your_password'
];
```

### 3. Start Development Servers

You need **two terminals**:

```bash
# Terminal 1: PHP backend (from project root)
php -S localhost:8000

# Terminal 2: Vite dev server (from qve folder)
cd qve
npm run dev
```

### 4. Open App

Navigate to: **http://localhost:5173/qve/**

## Vite Proxy Configuration

The Vite dev server proxies API requests to PHP. See `qve/vite.config.ts`:

```typescript
server: {
  proxy: {
    '/resources/php': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

## Common Development Tasks

### Adding a New Component

1. Create file in appropriate category:
   ```bash
   qve/src/lib/components/ui/MyComponent.svelte
   ```

2. Export from index:
   ```typescript
   // qve/src/lib/components/index.ts
   export { default as MyComponent } from './ui/MyComponent.svelte';
   ```

3. Use in routes or other components:
   ```svelte
   <script>
     import { MyComponent } from '$lib/components';
   </script>
   ```

### Adding a New Store

1. Create store file:
   ```typescript
   // qve/src/lib/stores/myStore.ts
   import { writable } from 'svelte/store';

   function createMyStore() {
     const { subscribe, set, update } = writable(initialValue);
     return {
       subscribe,
       doSomething: () => update(state => /* ... */)
     };
   }

   export const myStore = createMyStore();
   ```

2. Export from index:
   ```typescript
   // qve/src/lib/stores/index.ts
   export { myStore } from './myStore';
   ```

### Adding a New API Method

1. Add method to client:
   ```typescript
   // qve/src/lib/api/client.ts
   async myNewMethod(params: MyParams): Promise<MyResponse> {
     return this.post('myEndpoint.php', params);
   }
   ```

2. Add types if needed:
   ```typescript
   // qve/src/lib/api/types.ts
   export interface MyParams { /* ... */ }
   export interface MyResponse { /* ... */ }
   ```

### Adding a New Route

1. Create route folder and page:
   ```
   qve/src/routes/my-route/+page.svelte
   ```

2. Add load function if needed:
   ```typescript
   // qve/src/routes/my-route/+page.ts
   export const load = async () => {
     return { /* data */ };
   };
   ```

## Build Commands

```bash
cd qve

# Development server with HMR
npm run dev

# Type checking
npm run check

# Linting
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

## Debugging

### Browser DevTools
- Components: Check Svelte DevTools extension
- Network: Monitor API calls in Network tab
- State: Console log store values with `$storeName`

### Common Issues

| Issue | Solution |
|-------|----------|
| API 404 | Ensure PHP server is running at localhost:8000 |
| CORS errors | Check Vite proxy configuration |
| TypeScript errors | Run `npm run check` for details |
| Store not reactive | Use `$store` syntax, not `store` |

## Git Workflow

```bash
# Create feature branch
git checkout main
git pull origin main
git checkout -b feature/WIN-XX-description

# Make changes and commit
git add .
git commit -m "feat: description

Refs: WIN-XX"

# Push and create PR
git push -u origin feature/WIN-XX-description
```

## Deployment

```powershell
# Preview changes
.\deploy.ps1 -DryRun

# Deploy to production
.\deploy.ps1

# Rollback if needed
.\deploy.ps1 -Rollback "2026-01-22_143022"
```
