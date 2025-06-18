export interface IElectronAPI {
  getBackendPort: () => Promise<number>
  openExternal: (url: string) => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
    global: Window & typeof globalThis
  }
}

declare let global: Window & typeof globalThis
