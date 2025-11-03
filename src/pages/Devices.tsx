import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io, { Socket } from 'socket.io-client';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Smartphone, 
  QrCode, 
  Key, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Device {
  sessionId: string;
  phoneNumber: string;
  name: string;
  status: string;
  platform: string;
  connectedAt?: string;
}

const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [qrCode, setQrCode] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('62'); // Default Indonesia
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pairing'>('qr');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionId] = useState<string>(`session-${Date.now()}`);
  const [qrExpiryTime, setQrExpiryTime] = useState<number>(0);
  const [error, setError] = useState<string>('');

  // Initialize socket connection
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    const newSocket = io(backendUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('Connected to backend');
      setConnectionStatus('Connected to server');
      // Get existing devices on connect
      newSocket.emit('getDevices');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setConnectionStatus('Disconnected from server');
    });

    // Handle QR code
    newSocket.on('qr', (data: { sessionId: string; qr: string }) => {
      console.log('QR code received');
      setQrCode(data.qr);
      setIsConnecting(true);
      setError('');
      // Reset QR expiry timer (QR codes expire in ~60 seconds)
      setQrExpiryTime(60);
    });

    // Handle pairing code
    newSocket.on('pairingCode', (data: { sessionId: string; code: string; phoneNumber: string }) => {
      console.log('Pairing code received:', data.code);
      setPairingCode(data.code);
      setIsConnecting(true);
      setError('');
      toast.success(`Pairing code: ${data.code}`);
    });

    // Handle successful connection
    newSocket.on('connectionSuccess', (data: { sessionId: string; deviceInfo: Device }) => {
      console.log('Connection successful:', data);
      setIsConnecting(false);
      setQrCode('');
      setPairingCode('');
      setPhoneNumber('');
      setConnectionStatus('Connected successfully');
      
      // Add new device to list
      setDevices(prev => [...prev, data.deviceInfo]);
      
      toast.success('WhatsApp connected successfully!');
    });

    // Handle connection errors
    newSocket.on('connectionError', (data: { sessionId: string; error: string }) => {
      console.error('Connection error:', data);
      setIsConnecting(false);
      setError(data.error);
      setConnectionStatus('Connection failed');
      toast.error(data.error);
    });

    // Handle pairing errors
    newSocket.on('pairingError', (data: { sessionId: string; error: string; details?: string }) => {
      console.error('Pairing error:', data);
      setIsConnecting(false);
      setError(data.details || data.error);
      setPairingCode('');
      toast.error(data.details || data.error);
    });

    // Handle connection closed
    newSocket.on('connectionClosed', (data: { sessionId: string; reason: string; message: string }) => {
      console.log('Connection closed:', data);
      setIsConnecting(false);
      setQrCode('');
      setPairingCode('');
      setConnectionStatus(data.message);
      
      // Remove device from list
      setDevices(prev => prev.filter(d => d.sessionId !== data.sessionId));
      
      toast(data.message);
    });

    // Handle devices list
    newSocket.on('devicesList', (data: { devices: Device[] }) => {
      console.log('Devices list received:', data);
      setDevices(data.devices || []);
    });

    // Handle general errors
    newSocket.on('error', (data: { message: string; error?: string }) => {
      console.error('Socket error:', data);
      setError(data.message);
      setIsConnecting(false);
      toast.error(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // QR Code expiry countdown
  useEffect(() => {
    if (qrExpiryTime > 0) {
      const timer = setTimeout(() => {
        setQrExpiryTime(qrExpiryTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (qrExpiryTime === 0 && qrCode) {
      setQrCode('');
      setError('QR code expired. Please request a new one.');
    }
  }, [qrExpiryTime, qrCode]);

  // Request QR Code
  const requestQRCode = useCallback(() => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    setError('');
    setIsConnecting(true);
    setConnectionStatus('Requesting QR code...');
    
    socket.emit('requestQR', { sessionId });
  }, [socket, sessionId]);

  // Request Pairing Code
  const requestPairingCode = useCallback(() => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    if (!phoneNumber) {
      toast.error('Please enter your phone number');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{8,15}$/;
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      toast.error('Invalid phone number format');
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanPhone}`;
    
    setError('');
    setIsConnecting(true);
    setConnectionStatus('Requesting pairing code...');
    
    socket.emit('requestPairing', { 
      sessionId, 
      phoneNumber: fullPhoneNumber 
    });
  }, [socket, sessionId, phoneNumber, countryCode]);

  // Copy pairing code to clipboard
  const copyPairingCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      toast.success('Pairing code copied to clipboard');
    }
  };

  // Disconnect device
  const disconnectDevice = (deviceSessionId: string) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    if (confirm('Are you sure you want to disconnect this device?')) {
      socket.emit('disconnectDevice', { sessionId: deviceSessionId });
    }
  };

  // Refresh devices list
  const refreshDevices = () => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }
    
    socket.emit('getDevices');
    toast.success('Devices list refreshed');
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WhatsApp Devices</h1>
        <p className="text-gray-600">Manage your connected WhatsApp devices</p>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{connectionStatus}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add New Device Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add New Device</CardTitle>
          <CardDescription>
            Connect a new WhatsApp device using QR code or pairing code
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Connection Method Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Connection Method</label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={connectionMethod === 'qr' ? 'default' : 'outline'}
                onClick={() => setConnectionMethod('qr')}
                className="flex items-center justify-center gap-2"
              >
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
              <Button
                variant={connectionMethod === 'pairing' ? 'default' : 'outline'}
                onClick={() => setConnectionMethod('pairing')}
                className="flex items-center justify-center gap-2"
              >
                <Key className="h-4 w-4" />
                Pairing Code
              </Button>
            </div>
          </div>

          {/* QR Code Method */}
          {connectionMethod === 'qr' && (
            <div className="text-center">
              {qrCode ? (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg shadow-lg mb-4">
                    <QRCodeSVG value={qrCode} size={256} />
                  </div>
                  {qrExpiryTime > 0 && (
                    <p className="text-sm text-gray-500 mb-2">
                      QR code expires in {qrExpiryTime} seconds
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    Scan this QR code with WhatsApp on your phone
                  </p>
                  <ol className="text-left text-sm mt-4 space-y-1">
                    <li>1. Open WhatsApp on your phone</li>
                    <li>2. Go to Settings → Linked Devices</li>
                    <li>3. Tap "Link a Device"</li>
                    <li>4. Scan this QR code</li>
                  </ol>
                </div>
              ) : (
                <div>
                  <Button
                    onClick={requestQRCode}
                    disabled={isConnecting}
                    className="mb-4"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Generate QR Code
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Pairing Code Method */}
          {connectionMethod === 'pairing' && (
            <div>
              {!pairingCode ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Select
                      value={countryCode}
                      onValueChange={setCountryCode}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="62">+62 (ID)</SelectItem>
                        <SelectItem value="1">+1 (US)</SelectItem>
                        <SelectItem value="44">+44 (UK)</SelectItem>
                        <SelectItem value="91">+91 (IN)</SelectItem>
                        <SelectItem value="60">+60 (MY)</SelectItem>
                        <SelectItem value="65">+65 (SG)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="tel"
                      placeholder="Phone number (without country code)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter your phone number without the country code. Example: 81234567890
                  </p>
                  <Button
                    onClick={requestPairingCode}
                    disabled={isConnecting || !phoneNumber}
                    className="w-full"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Key className="mr-2 h-4 w-4" />
                        Get Pairing Code
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-6 mb-4">
                    <p className="text-3xl font-mono font-bold tracking-wider">
                      {pairingCode}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={copyPairingCode}
                    className="mb-4"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </Button>
                  <p className="text-sm text-gray-600">
                    Enter this code in WhatsApp on your phone:
                  </p>
                  <ol className="text-left text-sm mt-4 space-y-1">
                    <li>1. Open WhatsApp on your phone</li>
                    <li>2. Go to Settings → Linked Devices</li>
                    <li>3. Tap "Link a Device"</li>
                    <li>4. Tap "Link with phone number instead"</li>
                    <li>5. Enter the code above</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Devices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Connected Devices</CardTitle>
            <CardDescription>
              {devices.length} device{devices.length !== 1 ? 's' : ''} connected
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDevices}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length > 0 ? (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.sessionId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Smartphone className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{device.name}</p>
                      <p className="text-sm text-gray-500">
                        {device.phoneNumber} • {device.platform}
                      </p>
                      {device.connectedAt && (
                        <p className="text-xs text-gray-400">
                          Connected: {new Date(device.connectedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Active</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectDevice(device.sessionId)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Smartphone className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No devices connected</p>
              <p className="text-sm mt-1">Add a device to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Devices;
