'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Wifi, WifiOff, Webhook as WebhookIcon, Trash2, Plus } from 'lucide-react';
import { deviceApi, simApi, webhookApi } from '@/lib/api';
import type { SimCard, Webhook, WebhookEvent } from '@/lib/api';

export default function DeviceDetailPage() {
  const params = useParams();
  const deviceId = params.id as string;
  const queryClient = useQueryClient();
  const [editingSim, setEditingSim] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [dailyLimitInput, setDailyLimitInput] = useState('');
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvent, setWebhookEvent] = useState('');

  const { data: deviceData } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => deviceApi.getById(deviceId),
  });

  const { data: simsData } = useQuery({
    queryKey: ['device-sims', deviceId],
    queryFn: () => deviceApi.getSims(deviceId),
  });

  const updateBalanceMutation = useMutation({
    mutationFn: ({ simId, totalLimit }: { simId: string; totalLimit: number }) =>
      simApi.updateBalance(simId, { totalLimit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sims', deviceId] });
      setEditingSim(null);
      setBalanceInput('');
    },
  });

  const updateDailyLimitMutation = useMutation({
    mutationFn: ({ simId, dailyLimit }: { simId: string; dailyLimit: number }) =>
      simApi.updateDailyLimit(simId, { dailyLimit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sims', deviceId] });
      setEditingSim(null);
      setDailyLimitInput('');
    },
  });

  const toggleSimMutation = useMutation({
    mutationFn: ({ simId, isActive }: { simId: string; isActive: boolean }) =>
      simApi.updateStatus(simId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sims', deviceId] });
    },
  });

  // Webhook queries and mutations
  const { data: webhooksData } = useQuery({
    queryKey: ['device-webhooks', deviceId],
    queryFn: () => webhookApi.getByDevice(deviceId),
  });

  const { data: webhookEventsData } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: () => webhookApi.getEvents(),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { url: string; event: string }) =>
      webhookApi.create(deviceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-webhooks', deviceId] });
      setShowAddWebhook(false);
      setWebhookUrl('');
      setWebhookEvent('');
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => webhookApi.delete(webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-webhooks', deviceId] });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) =>
      webhookApi.toggleStatus(webhookId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-webhooks', deviceId] });
    },
  });

  const device = deviceData?.data.data;
  const sims = simsData?.data.data || [];
  const webhooks = webhooksData?.data.data || [];
  const webhookEvents = webhookEventsData?.data.data || [];

  if (!device) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading device...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Link
              href="/devices"
              className="mr-4 text-gray-500 hover:text-gray-900"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                {device.name || device.deviceId}
              </h1>
              <p className="text-sm text-gray-500">{device.deviceId}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Device Info */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Device Information</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <div className="flex items-center mt-1">
                {device.status === 'online' ? (
                  <Wifi className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <WifiOff className="h-5 w-5 text-gray-400 mr-2" />
                )}
                <span className="font-medium capitalize">{device.status}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Username</p>
              <p className="font-medium">{device.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sent</p>
              <p className="font-medium">{device.totalSent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Failed</p>
              <p className="font-medium">{device.totalFailed.toLocaleString()}</p>
            </div>
            {device.lastSeenAt && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Last Seen</p>
                <p className="font-medium">{new Date(device.lastSeenAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Health Data from Ping */}
        {(device.batteryLevel !== null || device.appVersion) && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Device Health</h2>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {device.batteryLevel !== null && (
                <div>
                  <p className="text-sm text-gray-500">Battery</p>
                  <div className="flex items-center mt-1">
                    <span className="font-medium">{device.batteryLevel}%</span>
                    {device.batteryCharging && (
                      <span className="ml-2 text-xs text-green-600">⚡ Charging</span>
                    )}
                  </div>
                </div>
              )}
              {device.appVersion && (
                <div>
                  <p className="text-sm text-gray-500">App Version</p>
                  <p className="font-medium">{device.appVersion}</p>
                </div>
              )}
              {device.connectionStatus !== null && (
                <div>
                  <p className="text-sm text-gray-500">Connection</p>
                  <p className={`font-medium ${device.connectionStatus ? 'text-green-600' : 'text-red-600'}`}>
                    {device.connectionStatus ? 'Online' : 'Offline'}
                  </p>
                </div>
              )}
              {device.failedMessagesHour !== null && (
                <div>
                  <p className="text-sm text-gray-500">Failed (1h)</p>
                  <p className={`font-medium ${device.failedMessagesHour > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {device.failedMessagesHour}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SIM Cards */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">SIM Cards</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {sims.map((sim: SimCard) => (
              <div key={sim.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                    <h3 className="text-sm font-medium text-gray-900">
                      {sim.name || `SIM ${sim.simNumber}`}
                    </h3>
                    {sim.phoneNumber && (
                      <span className="ml-2 text-xs text-gray-500">({sim.phoneNumber})</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        sim.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {sim.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => toggleSimMutation.mutate({ simId: sim.id, isActive: !sim.isActive })}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {sim.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Balance</p>
                    {editingSim === `${sim.id}-balance` ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={balanceInput}
                          onChange={(e) => setBalanceInput(e.target.value)}
                          className="w-20 border rounded px-2 py-1 text-sm"
                          placeholder="Limit"
                        />
                        <button
                          onClick={() => updateBalanceMutation.mutate({
                            simId: sim.id,
                            totalLimit: parseInt(balanceInput) || 0
                          })}
                          className="text-xs text-green-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingSim(null); setBalanceInput(''); }}
                          className="text-xs text-red-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="font-medium">
                          {sim.smsRemaining.toLocaleString()} / {sim.totalSmsLimit.toLocaleString()}
                        </span>
                        <button
                          onClick={() => {
                            setEditingSim(`${sim.id}-balance`);
                            setBalanceInput(sim.totalSmsLimit.toString());
                          }}
                          className="ml-2 text-xs text-blue-600"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-500">Daily Limit</p>
                    {editingSim === `${sim.id}-daily` ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={dailyLimitInput}
                          onChange={(e) => setDailyLimitInput(e.target.value)}
                          className="w-20 border rounded px-2 py-1 text-sm"
                          placeholder="Limit"
                        />
                        <button
                          onClick={() => updateDailyLimitMutation.mutate({
                            simId: sim.id,
                            dailyLimit: parseInt(dailyLimitInput) || 100
                          })}
                          className="text-xs text-green-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingSim(null); setDailyLimitInput(''); }}
                          className="text-xs text-red-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="font-medium">
                          {sim.dailySmsSent} / {sim.dailySmsLimit}
                        </span>
                        <button
                          onClick={() => {
                            setEditingSim(`${sim.id}-daily`);
                            setDailyLimitInput(sim.dailySmsLimit.toString());
                          }}
                          className="ml-2 text-xs text-blue-600"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-500">Used</p>
                    <p className="font-medium">{sim.smsUsed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-medium capitalize">{sim.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhooks Section */}
        <div className="bg-white rounded-lg shadow mt-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <WebhookIcon className="h-5 w-5 mr-2 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Webhooks</h2>
            </div>
            <button
              onClick={() => setShowAddWebhook(true)}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Webhook
            </button>
          </div>

          {/* Add Webhook Form */}
          {showAddWebhook && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Register New Webhook</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Webhook URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-server.com/webhooks/sms-gate"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must end with <code className="bg-gray-200 px-1 rounded">/webhooks/sms-gate</code>
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Event Type</label>
                  <select
                    value={webhookEvent}
                    onChange={(e) => setWebhookEvent(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select an event...</option>
                    {webhookEvents.map((event: WebhookEvent) => (
                      <option key={event.value} value={event.value}>
                        {event.label} - {event.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      // Auto-append /webhooks/sms-gate if not present
                      let finalUrl = webhookUrl.trim();
                      if (!finalUrl.endsWith('/webhooks/sms-gate')) {
                        finalUrl = finalUrl.replace(/\/$/, '') + '/webhooks/sms-gate';
                      }
                      createWebhookMutation.mutate({ url: finalUrl, event: webhookEvent });
                    }}
                    disabled={!webhookUrl || !webhookEvent || createWebhookMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {createWebhookMutation.isPending ? 'Registering...' : 'Register'}
                  </button>
                  <button
                    onClick={() => { setShowAddWebhook(false); setWebhookUrl(''); setWebhookEvent(''); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Webhooks List */}
          <div className="divide-y divide-gray-200">
            {webhooks.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <WebhookIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No webhooks registered yet.</p>
                <p className="text-sm mt-1">Add a webhook to receive real-time notifications.</p>
              </div>
            ) : (
              webhooks.map((webhook: Webhook) => (
                <div key={webhook.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {webhook.event}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        webhook.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate max-w-md">{webhook.url}</p>
                    {webhook.lastTriggeredAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleWebhookMutation.mutate({ webhookId: webhook.id, isActive: !webhook.isActive })}
                      className={`px-3 py-1 text-sm rounded ${
                        webhook.isActive
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {webhook.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                      disabled={deleteWebhookMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
