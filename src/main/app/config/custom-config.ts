export default () => ({
  n8n: {
    endpoint: process.env.N8N_WEBHOOK_ENDPOINT,
  },
  keymaster: {
    endpoint: 'http://km.fot.kr',
    service: 'dcinside',
  },
})
