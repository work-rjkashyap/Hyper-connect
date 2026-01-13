# Hyper-connect 🚀

Hyper-connect is a modern Electron-based application designed for seamless device connectivity. Built with React and TypeScript, it provides a robust interface for discovering, managing, and interacting with networked devices.

---

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Routing**: [React Router 7](https://reactrouter.com/)
- **Build Tool**: [electron-vite](https://electron-vite.org/)
- **Utility**: [Bonjour Service](https://github.com/watson/bonjour-service), [Radix UI](https://www.radix-ui.com/)

---

## ✨ Core Features

- **Device Discovery**: Automated networking using Bonjour/mDNS.
- **Onboarding Flow**: Smooth user experience for initial setup.
- **Dynamic UI**: Responsive design with theme support (Light/Dark).
- **Store Management**: Persistent local storage using `electron-store`.

---

## 📂 Project Structure

```text
├── .github/workflows  # CI/CD (Build & Release)
├── resources          # Static assets for packaging
├── src
│   ├── main           # Electron main process
│   ├── preload        # Exposure of APIs to renderer
│   ├── renderer       # React frontend application
│   │   ├── components # Reusable UI components
│   │   ├── pages      # Main application views
│   │   └── store      # Zustand state definitions
│   └── shared         # Shared types and utilities
└── release.sh         # Manual release trigger script
```

---

## 🚀 Getting Started

### Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Build for all platforms
npm run build:all

# Platform-specific builds
npm run build:win
npm run build:mac
npm run build:linux
```

---

## 📦 Release Process

The project follows [Semantic Versioning (SemVer)](https://semver.org/) and uses GitHub Actions for automated releases.

### Triggering a Release

To trigger a new release, use the provided `release.sh` script with the target version:

```bash
./release.sh v1.0.0
```

**What happens next?**
1. The script commits your changes with a "Release vX.X.X" message.
2. It pushes the code and a new Git tag (`vX.X.X`) to the repository.
3. The **Build and Release** GitHub Action starts automatically.
4. It builds the app for Windows, macOS, and Linux.
5. It creates a GitHub Release and uploads the artifacts (`.exe`, `.dmg`, `.AppImage`, etc.).

### Semantic Versioning Guidelines

When committing or releasing, please follow these guidelines:
- **Patch (v0.0.x)**: Bug fixes and minor tweaks.
- **Minor (v0.x.0)**: New features that are backward compatible.
- **Major (vx.0.0)**: Breaking changes or significant updates.

> [!TIP]
> Always ensure your code passes linting and type checks (`npm run typecheck`) before triggering a release.
