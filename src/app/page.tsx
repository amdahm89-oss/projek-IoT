'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Mountain, Wifi, WifiOff, Lightbulb, Power, Activity } from 'lucide-react'

interface LED {
  id: string
  name: string
  status: boolean
  color: string
  location: string
}

export default function LEDControlDashboard() {
  const [ledStatus, setLedStatus] = useState<boolean>(false)
  const [mqttStatus, setMqttStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Check MQTT connection status
    const checkMQTTStatus = async () => {
      try {
        setMqttStatus('connecting')
        const response = await fetch('/api/mqtt')
        const data = await response.json()
        
        if (data.success && data.status.connected) {
          setMqttStatus('connected')
        } else {
          setMqttStatus('disconnected')
        }
      } catch (error) {
        console.error('Failed to check MQTT status:', error)
        setMqttStatus('disconnected')
      }
    }

    // Subscribe to ESP8266 LED control topic
    const subscribeToLED = async () => {
      try {
        await fetch('/api/mqtt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: 'esp8266/led/control',
            action: 'subscribe'
          })
        })
      } catch (error) {
        console.error('Failed to subscribe to LED topic:', error)
      }
    }

    checkMQTTStatus()
    subscribeToLED()

    // Set up periodic status checks
    const interval = setInterval(checkMQTTStatus, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const refreshStatus = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/mqtt')
      const data = await response.json()
      
      if (data.success) {
        setMqttStatus(data.status.connected ? 'connected' : 'disconnected')
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to refresh status:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const toggleLED = async () => {
    const newStatus = !ledStatus
    
    // Optimistic update
    setLedStatus(newStatus)
    
    // Send MQTT message
    try {
      const response = await fetch('/api/mqtt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'esp8266/led/control',
          message: newStatus ? 'ON' : 'OFF',
          action: 'publish'
        })
      })
      
      if (response.ok) {
        setLastUpdate(new Date())
      } else {
        // Revert on error
        setLedStatus(!newStatus)
      }
    } catch (error) {
      console.error('Failed to send MQTT message:', error)
      // Revert on error
      setLedStatus(!newStatus)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50">
      {/* Mountain Theme Header */}
      <div className="bg-gradient-to-r from-green-800 via-emerald-700 to-teal-800 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mountain className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">ESP8266 LED Control</h1>
                <p className="text-green-100 text-sm">HiveMQ Broker Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {mqttStatus === 'connected' ? (
                  <><Wifi className="w-5 h-5 text-green-300" /><Badge variant="secondary" className="bg-green-600 text-white">Connected</Badge></>
                ) : mqttStatus === 'connecting' ? (
                  <><Activity className="w-5 h-5 text-yellow-300 animate-pulse" /><Badge variant="secondary" className="bg-yellow-600 text-white">Connecting</Badge></>
                ) : (
                  <><WifiOff className="w-5 h-5 text-red-300" /><Badge variant="secondary" className="bg-red-600 text-white">Disconnected</Badge></>
                )}
              </div>
              <Button
                onClick={refreshStatus}
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <Activity className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {lastUpdate && (
                <div className="text-sm text-green-100">
                  Last: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Single LED Control Card */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm transition-all duration-300 hover:shadow-lg border-2">
            <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100">
              <CardTitle className="flex items-center justify-center text-2xl font-bold text-green-800">
                <Lightbulb className="w-8 h-8 mr-3" />
                ESP8266 LED Control
              </CardTitle>
              <p className="text-center text-gray-600">Topic: esp8266/led/control</p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col items-center space-y-6">
                {/* LED Status Indicator */}
                <div className="relative">
                  <div className={`w-32 h-32 rounded-full ${ledStatus ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'} transition-all duration-300 flex items-center justify-center shadow-lg`}>
                    <Lightbulb className={`w-16 h-16 ${ledStatus ? 'text-yellow-900' : 'text-gray-500'}`} />
                  </div>
                  {ledStatus && (
                    <div className="absolute inset-0 w-32 h-32 rounded-full bg-yellow-300 animate-ping opacity-20"></div>
                  )}
                </div>

                {/* Status Badge */}
                <Badge 
                  variant={ledStatus ? "default" : "secondary"}
                  className={`text-lg px-6 py-2 ${ledStatus ? "bg-green-600" : "bg-gray-300 text-gray-600"}`}
                >
                  {ledStatus ? 'LED ON' : 'LED OFF'}
                </Badge>

                {/* Control Button */}
                <Button
                  onClick={toggleLED}
                  size="lg"
                  className={`text-lg px-8 py-3 transition-all duration-300 ${
                    ledStatus 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  disabled={mqttStatus !== 'connected'}
                >
                  <Power className="w-5 h-5 mr-2" />
                  {ledStatus ? 'Turn LED OFF' : 'Turn LED ON'}
                </Button>

                {/* Connection Status */}
                <div className="text-center text-sm text-gray-500">
                  <p>Broker: broker.hivemq.com</p>
                  <p>Port: 1884</p>
                  <p className="mt-2 font-medium">
                    Status: {mqttStatus === 'connected' ? 'Connected' : mqttStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-6 bg-gradient-to-r from-gray-50 to-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Mountain className="w-4 h-4" />
                  <span>ESP8266 LED Control System</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">MQTT Topic:</span>
                  <Badge variant="outline" className="text-xs">esp8266/led/control</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}