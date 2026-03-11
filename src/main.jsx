import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import ResearchTerminal from './terminal'
import ErrorBoundary from './terminal/components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ResearchTerminal />
    <Analytics />
    <SpeedInsights />
  </ErrorBoundary>,
)