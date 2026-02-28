import React from 'react'
import ReactDOM from 'react-dom/client'
import ResearchTerminal from './terminal'
import ErrorBoundary from './terminal/components/ErrorBoundary'
import './index.css'
import { inject } from '@vercel/analytics'

inject()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ResearchTerminal />
    </ErrorBoundary>
  </React.StrictMode>,
)