import { NextRequest, NextResponse } from 'next/server'

// MQTT connection configuration
const MQTT_CONFIG = {
  broker: 'broker.hivemq.com',
  port: 8884, // WebSocket port for secure connection
  clientId: `mountain-led-${Math.random().toString(16).substr(2, 8)}`,
  username: '', // Public broker, no username needed
  password: ''  // Public broker, no password needed
}

// Store active connections and subscriptions
const connections = new Map<string, any>()
const subscriptions = new Set<string>()

// WebSocket-based MQTT client (simulated for this example)
class MockMQTTClient {
  private connected = false
  private clientId: string
  private messageHandlers: Map<string, ((message: any) => void)[]> = new Map()

  constructor(clientId: string) {
    this.clientId = clientId
  }

  async connect() {
    // Simulate connection to HiveMQ broker
    console.log(`Connecting to MQTT broker ${MQTT_CONFIG.broker}:${MQTT_CONFIG.port} with client ID: ${this.clientId}`)
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    this.connected = true
    console.log('Connected to MQTT broker successfully')
    return true
  }

  async publish(topic: string, message: string | boolean) {
    if (!this.connected) {
      throw new Error('Not connected to MQTT broker')
    }

    console.log(`Publishing to topic "${topic}": ${message}`)
    
    // Simulate MQTT publish for ESP8266 LED control
    const payload = {
      topic,
      message,
      timestamp: new Date().toISOString(),
      clientId: this.clientId,
      device: 'ESP8266',
      command: message === 'ON' ? 'LED_ON' : message === 'OFF' ? 'LED_OFF' : 'UNKNOWN'
    }

    // Simulate successful publish
    return { success: true, payload }
  }

  async subscribe(topic: string, callback: (message: any) => void) {
    if (!this.connected) {
      throw new Error('Not connected to MQTT broker')
    }

    console.log(`Subscribing to topic: ${topic}`)
    
    if (!this.messageHandlers.has(topic)) {
      this.messageHandlers.set(topic, [])
    }
    this.messageHandlers.get(topic)!.push(callback)
    subscriptions.add(topic)

    // Simulate receiving LED status updates every 15 seconds for demo
    const simulateMessage = () => {
      if (this.connected && subscriptions.has(topic)) {
        const mockMessage = {
          topic,
          payload: {
            status: Math.random() > 0.5 ? 'ON' : 'OFF',
            timestamp: new Date().toISOString(),
            device: 'ESP8266',
            led_state: Math.random() > 0.5
          }
        }
        
        const handlers = this.messageHandlers.get(topic) || []
        handlers.forEach(handler => handler(mockMessage))
        
        setTimeout(simulateMessage, 15000) // Simulate every 15 seconds
      }
    }
    
    setTimeout(simulateMessage, 8000) // Start after 8 seconds
    
    return { success: true, topic }
  }

  disconnect() {
    this.connected = false
    console.log('Disconnected from MQTT broker')
  }

  isConnected() {
    return this.connected
  }
}

// POST /api/mqtt - Send MQTT message
export async function POST(request: NextRequest) {
  try {
    const { topic, message, action = 'publish' } = await request.json()

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Get or create MQTT client
    let client = connections.get('default')
    if (!client) {
      client = new MockMQTTClient(MQTT_CONFIG.clientId)
      await client.connect()
      connections.set('default', client)
    }

    if (action === 'publish') {
      const result = await client.publish(topic, message)
      return NextResponse.json({ 
        success: true, 
        message: `Message sent to ${topic}`,
        data: result 
      })
    } else if (action === 'subscribe') {
      const result = await client.subscribe(topic, (msg) => {
        console.log('Received message:', msg)
      })
      return NextResponse.json({ 
        success: true, 
        message: `Subscribed to ${topic}`,
        data: result 
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('MQTT API Error:', error)
    return NextResponse.json({ 
      error: 'Failed to process MQTT request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/mqtt - Get MQTT status and subscriptions
export async function GET() {
  try {
    const client = connections.get('default')
    const status = {
      connected: client ? client.isConnected() : false,
      broker: MQTT_CONFIG.broker,
      port: MQTT_CONFIG.port,
      clientId: MQTT_CONFIG.clientId,
      subscriptions: Array.from(subscriptions),
      topic: 'esp8266/led/control',
      device: 'ESP8266',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error('MQTT Status Error:', error)
    return NextResponse.json({ 
      error: 'Failed to get MQTT status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE /api/mqtt - Disconnect MQTT
export async function DELETE() {
  try {
    const client = connections.get('default')
    if (client) {
      client.disconnect()
      connections.delete('default')
      subscriptions.clear()
    }

    return NextResponse.json({ 
      success: true, 
      message: 'MQTT client disconnected' 
    })
  } catch (error) {
    console.error('MQTT Disconnect Error:', error)
    return NextResponse.json({ 
      error: 'Failed to disconnect MQTT',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}