declare global {
  interface Window {
    electronAPI: {
      getBackendPort: () => Promise<number>
      openExternal: (url: string) => Promise<void>
    }
  }
}

export {}
