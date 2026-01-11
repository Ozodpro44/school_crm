# Dependencies Information

## Dependency Resolution

The developer dashboard uses compatible versions of all dependencies to ensure smooth installation and operation.

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^15.0.0 | React framework |
| react | ^18.2.0 | UI library |
| react-dom | ^18.2.0 | React DOM rendering |
| typescript | ^5.0.0 | Type safety |
| tailwindcss | ^3.3.0 | CSS framework |
| zustand | ^4.4.0 | State management |
| axios | ^1.6.0 | HTTP client |
| lucide-react | ^0.366.0 | Icon library |
| clsx | ^2.0.0 | Utility for class names |
| date-fns | ^2.30.0 | Date utilities |

### Why React 18?

- Next.js 15 is compatible with both React 18 and 19
- React 18 has broader ecosystem support
- lucide-react 0.366+ supports React 18
- All components use React 18 compatible syntax

### Installation

```bash
npm install
```

Should install without issues. If you see warnings about deprecated packages, these are from ESLint and other dev tools - they don't affect the application.

### Troubleshooting Dependencies

**Error: peer react conflicts**
- This is resolved with the current package.json versions
- Run `npm install` without flags

**Slow installation**
- npm may need to resolve dependencies
- Be patient, it usually takes 30-60 seconds
- Network speed affects installation time

**Old node_modules**
- If issues persist, clear cache:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

## Development Dependencies

- **@types/node** - Node.js type definitions
- **@types/react** - React type definitions  
- **@types/react-dom** - React DOM type definitions
- **eslint** - Code quality tool
- **eslint-config-next** - Next.js ESLint config

These are only used during development and are not bundled in production.

## Production Build

Production builds use tree-shaking to remove unused code:

```bash
npm run build
npm start
```

The build optimizes all dependencies for size and performance.

## Version Compatibility

- **Node.js**: 18+ (tested on 18, 20, 22)
- **npm**: 8+ (works with 9, 10, 11)
- **Browsers**: Modern browsers (Chrome, Firefox, Safari, Edge)

## Further Reading

- [Next.js Documentation](https://nextjs.org/docs)
- [React 18 Features](https://react.dev)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Axios Documentation](https://axios-http.com)
- [Tailwind CSS](https://tailwindcss.com)
