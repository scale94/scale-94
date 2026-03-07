import React from 'react'
import ReactDOM from 'react-dom/client'
import ResearchTerminal from './terminal'
import ErrorBoundary from './terminal/components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ResearchTerminal />
  </ErrorBoundary>,
)