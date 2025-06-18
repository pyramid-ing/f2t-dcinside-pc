export interface Env {
  PORT: number
}

export interface CustomConfig {
  n8n: {
    webhookUrl: string
  }
}
