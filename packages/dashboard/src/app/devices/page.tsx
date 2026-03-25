'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Plus, Wifi, WifiOff, Trash2, X } from 'lucide-react';
import { deviceApi } from '@/lib/api';
import type { Device } from '@/lib/api';

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevice, setNewDevice] = useState({
    deviceId: '',
    name: '',
    username: '',
    password: '',
  });

  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => deviceApi.getAll(),
  });

  const createDeviceMutation = useMutation({
    mutationFn: (data: typeof newDevice) => deviceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setShowAddModal(false);
      setNewDevice({ deviceId: '', name: '', username: '', password: '' });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (id: string) => deviceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const devices = devicesData?.data.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Devices
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </button>
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">Add New Device</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDevice.deviceId}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                  placeholder="e.g., Dl8bV2Af9_JfvyZwy67kC"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">From SMS-Gate app Home tab</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  placeholder="e.g., My Phone"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDevice.username}
                  onChange={(e) => setNewDevice({ ...newDevice, username: e.target.value })}
                  placeholder="From SMS-Gate app Home tab"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newDevice.password}
                  onChange={(e) => setNewDevice({ ...newDevice, password: e.target.value })}
                  placeholder="From SMS-Gate app Home tab"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => createDeviceMutation.mutate(newDevice)}
                disabled={!newDevice.deviceId || !newDevice.username || !newDevice.password || createDeviceMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {createDeviceMutation.isPending ? 'Adding...' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Smartphone className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No devices</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by registering a new device.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device: Device) => (
              <div
                key={device.id}
                className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/devices/${device.id}`} className="flex items-center flex-1">
                    <div className={`rounded-full p-2 ${device.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {device.status === 'online' ? (
                        <Wifi className="h-5 w-5 text-green-600" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900">
                        {device.name || device.deviceId}
                      </h3>
                      <p className="text-xs text-gray-500">{device.deviceId}</p>
                    </div>
                  </Link>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        device.status === 'online'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {device.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${device.name || device.deviceId}"?`)) {
                          deleteDeviceMutation.mutate(device.id);
                        }
                      }}
                      disabled={deleteDeviceMutation.isPending}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Link href={`/devices/${device.id}`}>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Sent</p>
                      <p className="font-medium">{device.totalSent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Failed</p>
                      <p className="font-medium">{device.totalFailed.toLocaleString()}</p>
                    </div>
                  </div>
                  {device.lastSeenAt && (
                    <p className="mt-4 text-xs text-gray-400">
                      Last seen: {new Date(device.lastSeenAt).toLocaleString()}
                    </p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
