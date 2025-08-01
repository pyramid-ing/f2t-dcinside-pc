export default () => ({
  n8n: {
    endpoint: process.env.N8N_WEBHOOK_ENDPOINT,
  },
  supabase: {
    endpoint: 'https://zdapznehrdujuigsngwc.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkYXB6bmVocmR1anVpZ3NuZ3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNTI2MjMsImV4cCI6MjA2OTYyODYyM30.rBIGHEpXmQBnVKf5SbblKJ1XF8JXJjFGdNoHrcm95rk',
    service: 'dcinside',
  },
})
