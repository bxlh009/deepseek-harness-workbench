import { createServer } from 'node:http'

const server = createServer((_request, response) => response.end('FreeLLMAPI'))
server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fixture did not bind TCP')
  process.send?.({
    type: 'freellmapi-ready',
    port: address.port,
    dashboardURL: `http://127.0.0.1:${String(address.port)}/dashboard`,
  })
})

process.on('disconnect', () => server.close(() => process.exit(0)))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
