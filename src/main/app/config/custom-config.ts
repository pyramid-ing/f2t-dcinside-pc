export default () => ({
  n8n: {
    endpoint: process.env.N8N_WEBHOOK_ENDPOINT,
  },
  supabase: {
    endpoint: 'https://fnvgikaaesqofdpaoskt.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmdpa2FhZXNxb2ZkcGFvc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMTM3ODQsImV4cCI6MjA2OTU4OTc4NH0.Nd5DrHPTwUVVfB6WYeTMsKEaOVv-6SO7AtxH0laUQ_o',
    service: 'dcinside',
  },
})
