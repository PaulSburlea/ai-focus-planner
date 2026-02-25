import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * Application Entry Point.
 * 
 * This file initializes the React application by:
 * 1. Locating the root DOM element in the HTML.
 * 2. Creating a React root using `createRoot` (enabling React 18+ concurrent features).
 * 3. Rendering the main `App` component wrapped in `StrictMode` for additional development checks.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)