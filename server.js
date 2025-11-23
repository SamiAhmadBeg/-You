// Register TypeScript support
require('tsx/cjs')

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  // Load WebSocket handler (TypeScript will be compiled on-the-fly by tsx)
  const { handleTwilioWebSocket } = require('./lib/websocket-handler-wrapper.ts')

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Create WebSocket server for Twilio Media Streams
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true)

    if (pathname === '/api/media-stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('🔌 WebSocket connection established')
        handleTwilioWebSocket(ws, request)
      })
    } else {
      socket.destroy()
    }
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})




