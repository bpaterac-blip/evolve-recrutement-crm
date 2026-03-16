import { createContext, useContext, useState } from 'react'

const ViewModeContext = createContext(null)

export function ViewModeProvider({ children }) {
  const [viewMode, setViewMode] = useState('personal')

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext)
  return ctx || { viewMode: 'personal', setViewMode: () => {} }
}
