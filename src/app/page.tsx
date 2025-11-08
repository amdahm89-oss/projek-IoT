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
  const [leds, setLeds] = useState<LED[]>([
    { id: 'led1', name: 'Summit Light', status: false, color: 'bg-yellow-400', location: 'Peak' },
    { id: 'led2', name: 'Trail Beacon', status: false, color: 'bg-blue-400', location: 'Path' },
    { id: 'led3', name: 'Base Camp', status: false, color: 'bg-green-400', location: 'Base' },
    { id: 'led4', name: 'Ridge Marker', status: false, color: 'bg-red-400', location: 'Ridge' },
    { id: 'led5', name: 'Valley Light', status: false, color: 'bg-purple-400', location: 'Valley' },
    { id: 'led6', name: 'Forest Glow', status: false, color: 'bg-orange-400', location: 'Forest' }
  ])

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

    // Subscribe to all LED topics for real-time updates
    const subscribeToAllLEDs = async () => {
      try {
        await Promise.all(leds.map(led =>
          fetch('/api/mqtt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: `led/${led.id}`,
              action: 'subscribe'
            })
          })
        ))
      } catch (error) {
        console.error('Failed to subscribe to LED topics:', error)
      }
    }

    checkMQTTStatus()
    subscribeToAllLEDs()

    // Set up periodic status checks
    const interval = setInterval(checkMQTTStatus, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [leds.map(led => led.id).join(',')]) // Re-run when LED IDs change

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

  const toggleLED = async (ledId: string) => {
    const newStatus = !leds.find(led => led.id === ledId)?.status
    
    // Optimistic update
    setLeds(prev => prev.map(led => 
      led.id === ledId ? { ...led, status: newStatus } : led
    ))
    
    // Send MQTT message
    try {
      const response = await fetch('/api/mqtt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `led/${ledId}`,
          message: newStatus,
          action: 'publish'
        })
      })
      
      if (response.ok) {
        setLastUpdate(new Date())
        
        // Subscribe to the topic for real-time updates
        await fetch('/api/mqtt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `led/${ledId}`,
            action: 'subscribe'
          })
        })
      } else {
        // Revert on error
        setLeds(prev => prev.map(led => 
          led.id === ledId ? { ...led, status: !newStatus } : led
        ))
      }
    } catch (error) {
      console.error('Failed to send MQTT message:', error)
      // Revert on error
      setLeds(prev => prev.map(led => 
        led.id === ledId ? { ...led, status: !newStatus } : led
      ))
    }
  }

  const toggleAllLEDs = async (status: boolean) => {
    // Optimistic update
    setLeds(prev => prev.map(led => ({ ...led, status })))
    
    // Send MQTT messages for all LEDs
    try {
      const promises = leds.map(async (led) => {
        const response = await fetch('/api/mqtt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `led/${led.id}`,
            message: status,
            action: 'publish'
          })
        })
        
        if (response.ok) {
          // Subscribe to the topic for real-time updates
          await fetch('/api/mqtt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: `led/${led.id}`,
              action: 'subscribe'
            })
          })
        }
        return response
      })
      
      const results = await Promise.all(promises)
      const allSuccessful = results.every(res => res.ok)
      
      if (allSuccessful) {
        setLastUpdate(new Date())
      } else {
        // Revert on error
        setLeds(prev => prev.map(led => ({ ...led, status: !status })))
      }
    } catch (error) {
      console.error('Failed to send MQTT messages:', error)
      // Revert on error
      setLeds(prev => prev.map(led => ({ ...led, status: !status })))
    }
  }

  const activeLEDs = leds.filter(led => led.status).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50">
      {/* Mountain Theme Header */}
      <div className="bg-gradient-to-r from-green-800 via-emerald-700 to-teal-800 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mountain className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Mountain LED Control</h1>
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
        {/* Control Panel */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-green-200">
          <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100">
            <CardTitle className="flex items-center space-x-2 text-green-800">
              <Power className="w-5 h-5" />
              <span>Master Control</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  onClick={() => toggleAllLEDs(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={mqttStatus !== 'connected'}
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Turn All On
                </Button>
                <Button 
                  onClick={() => toggleAllLEDs(false)}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={mqttStatus !== 'connected'}
                >
                  Turn All Off
                </Button>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Activity className="w-4 h-4" />
                <span className="font-medium">{activeLEDs} of {leds.length} LEDs Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LED Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leds.map((led) => (
            <Card 
              key={led.id} 
              className={`bg-white/90 backdrop-blur-sm transition-all duration-300 hover:shadow-lg border-2 ${
                led.status ? 'border-green-400 shadow-green-100' : 'border-gray-200'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-800">
                    {led.name}
                  </CardTitle>
                  <div className={`w-4 h-4 rounded-full ${led.color} ${led.status ? 'animate-pulse' : 'opacity-30'}`} />
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Mountain className="w-3 h-3" />
                  <span>{led.location}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={led.id}
                      checked={led.status}
                      onCheckedChange={() => toggleLED(led.id)}
                      disabled={mqttStatus !== 'connected'}
                    />
                    <Label htmlFor={led.id} className="text-sm font-medium">
                      {led.status ? 'ON' : 'OFF'}
                    </Label>
                  </div>
                  <Badge 
                    variant={led.status ? "default" : "secondary"}
                    className={led.status ? "bg-green-600" : "bg-gray-300 text-gray-600"}
                  >
                    {led.status ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Bar */}
        <Card className="mt-8 bg-gradient-to-r from-gray-50 to-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <Mountain className="w-4 h-4" />
                <span>Mountain LED Control System</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-500">Broker: broker.hivemq.com</span>
                <span className="text-gray-500">Port: 1884</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}