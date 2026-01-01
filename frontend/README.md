# Frontend Application

The admin dashboard and public forms for the Lead Magnet AI Platform.

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: AWS Cognito (via Amplify)
- **State Management**: React Query (TanStack Query)

## 📂 Project Structure

- `src/app`: Next.js App Router pages and layouts
- `src/components`: Reusable UI components
- `src/lib/api`: Strongly-typed API clients
- `src/hooks`: Custom React hooks
- `src/types`: TypeScript type definitions
- `e2e`: Playwright end-to-end tests

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📚 Documentation

- [Frontend Test Guide](../../docs/testing/FRONTEND_TEST_GUIDE.md)
- [Local Development](../../docs/guides/LOCAL_DEVELOPMENT.md)
- [API Contracts](../../docs/reference/contracts/README.md)
