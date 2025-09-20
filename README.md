This repo was made for an interview's take home assignment. The exercise was pretty fun.


# Fox Celebration Uploads

A modern, high-performance file upload application built with Next.js 15, featuring real-time progress tracking, state machine-driven upload management, and a responsive user interface.

## Features

- **Drag & Drop Interface**: Intuitive file selection with drag-and-drop support
- **Real-time Progress Tracking**: Live upload progress with detailed status indicators
- **State Machine Architecture**: Robust upload state management using finite state machines
- **Retry Functionality**: Smart retry logic for failed uploads with user-friendly error handling
- **Persistent State**: Upload progress persists across page refreshes using localStorage
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Comprehensive Testing**: Unit tests with Vitest and testing utilities


## Technology Stack

### Frontend
- **Next.js 15**: React framework with App Router and Turbopack
- **React 19**: Latest React with concurrent features
- **TypeScript**: Full type safety and developer experience
- **Tailwind CSS 4**: Utility-first CSS framework
- **Jotai**: Atomic state management for React
- **Framer Motion**: Smooth animations and transitions
- **React Dropzone**: File drag-and-drop functionality
- **Lucide React**: Modern icon library

### State Management
- **Jotai Atoms**: Granular state management with atomic updates
- **State Machines**: Upload and overall progress state machines
- **Local Storage**: Persistent state across browser sessions

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- npm, yarn, or pnpm package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rockia/fox-celebration-uploads.git
cd fox-celebration-uploads
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint for code quality
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once

## Architecture Overview

### Project Structure

```
foxy-uploads/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── upload/        # File upload endpoints
│   │   ├── upload-url/    # Upload URL generation
│   │   └── upload-complete/ # Upload completion handling
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Home page
├── atoms/                 # Jotai state atoms
│   ├── uploads.ts         # Upload state management
│   ├── uploadStateMachine.ts # Individual upload state machine
│   ├── overallProgressStateMachine.ts # Overall progress state machine
│   └── upload-stats.ts    # Derived upload statistics
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── UploadProgress.tsx # Upload progress display
│   ├── OverallProgressBar.tsx # Overall progress indicator
│   └── ...               # Other components
├── hooks/                 # Custom React hooks
│   └── useFileUpload.ts  # File upload hook
├── lib/                   # Utility libraries
│   ├── utils.ts          # General utilities
│   └── localStorage.ts   # Local storage management
└── public/               # Static assets
```

### State Management Architecture

The application uses a sophisticated state management system built on Jotai atoms and state machines:

#### Upload State Machine
Each file upload follows a finite state machine with these states:
- `idle` → `reserving` → `ready` → `uploading` → `success`
- Error states: `error`, `canceled`
- Retry capability for failed uploads

#### Overall Progress State Machine
Manages the global upload state:
- `idle` → `preparing` → `ready` → `uploading` → `completed`
- Handles partial completions and error scenarios

#### Key Atoms
- `uploadsAtom`: Core upload state with file objects and metadata
- `overallProgressAtom`: Computed overall progress and status
- `uploadStatsAtom`: Derived statistics for UI display

### API Design

The application implements a mocked RESTful API for upload management:

#### Endpoints
- `POST /api/upload-url`: Generate signed upload URLs
- `PUT /api/upload/[id]`: Upload file content
- `POST /api/upload-complete/[id]`: Notify upload completion

#### Mock Implementation
The current implementation includes sophisticated mocking:
- Realistic network delays and failure simulation
- Configurable failure rates for testing resilience
- Proper HTTP status codes and error messages

### Upload Flow

1. **File Selection**: User selects files via drag-and-drop or file picker
2. **URL Reservation**: Application requests upload URLs from the API
3. **File Upload**: Files are uploaded to the reserved URLs
4. **Progress Tracking**: Real-time progress updates with state transitions
5. **Completion**: Upload completion is reported to the API
6. **Error Handling**: Failed uploads can be retried with exponential backoff

### Progress Calculation

The application implements accurate progress calculation:
- Successful uploads contribute 100% to overall progress
- Currently uploading files contribute their current progress percentage
- Failed, canceled, and pending uploads contribute 0%
- Progress persists across page refreshes

### Error Handling

Comprehensive error handling includes:
- Network failure detection and retry logic
- User-friendly error messages for different failure types
- Distinction between retryable and permanent errors
- Graceful handling of page refresh scenarios





## Development Guidelines


### State Management
- Use Jotai atoms for granular state management
- Implement state machines for complex workflows
- Persist critical state to localStorage
- Follow immutable update patterns
