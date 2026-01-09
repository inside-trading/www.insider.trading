// WebSocket service for real-time updates

const WebSocket = require('ws');
const Token = require('../models/Token');
const Pool = require('../models/Pool');
const config = require('../config');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map();

    this.setupConnectionHandler();
    this.startPriceUpdates();
    this.startHeartbeat();

    console.log('WebSocket server initialized');
  }

  setupConnectionHandler() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();

      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(['prices']), // Default subscription
        lastPing: Date.now()
      });

      console.log(`Client connected: ${clientId}`);

      // Send initial data
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: Date.now()
      });

      this.sendToClient(clientId, {
        type: 'prices',
        data: Token.getPrices(),
        timestamp: Date.now()
      });

      // Handle messages
      ws.on('message', (message) => {
        this.handleMessage(clientId, message);
      });

      // Handle close
      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error.message);
        this.clients.delete(clientId);
      });

      // Handle pong
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = Date.now();
        }
      });
    });
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (data.type) {
        case 'subscribe':
          if (data.channel) {
            client.subscriptions.add(data.channel);
            this.sendToClient(clientId, {
              type: 'subscribed',
              channel: data.channel,
              timestamp: Date.now()
            });
          }
          break;

        case 'unsubscribe':
          if (data.channel) {
            client.subscriptions.delete(data.channel);
            this.sendToClient(clientId, {
              type: 'unsubscribed',
              channel: data.channel,
              timestamp: Date.now()
            });
          }
          break;

        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now()
          });
          break;

        case 'getQuote':
          // Handle quote request
          this.sendToClient(clientId, {
            type: 'quote',
            data: {
              fromToken: data.fromToken,
              toToken: data.toToken,
              amount: data.amount,
              rate: Token.getPrice(data.fromToken) / Token.getPrice(data.toToken)
            },
            timestamp: Date.now()
          });
          break;

        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error.message);
    }
  }

  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  broadcast(channel, data) {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  startPriceUpdates() {
    setInterval(() => {
      this.broadcast('prices', {
        type: 'prices',
        data: Token.getPrices(),
        timestamp: Date.now()
      });
    }, config.ws.priceUpdateInterval);
  }

  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Check if client is still responsive
          if (Date.now() - client.lastPing > config.ws.heartbeatInterval * 2) {
            console.log(`Client ${clientId} timed out`);
            client.ws.terminate();
            this.clients.delete(clientId);
            return;
          }

          client.ws.ping();
        }
      });
    }, config.ws.heartbeatInterval);
  }

  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9);
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      subscriptions: Array.from(this.clients.values()).reduce((acc, client) => {
        client.subscriptions.forEach(sub => {
          acc[sub] = (acc[sub] || 0) + 1;
        });
        return acc;
      }, {})
    };
  }
}

module.exports = WebSocketService;
