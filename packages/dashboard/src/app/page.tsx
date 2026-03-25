'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, CreditCard, MessageSquare, Activity } from 'lucide-react';
import { deviceApi, messageApi } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

export default function Dashboard() {
  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => deviceApi.getAll(),
  });

  const { data: messagesData } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messageApi.getAll(100),
  });

  const devices = devicesData?.data.data || [];
  const messages = messagesData?.data.data || [];

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const totalSent = devices.reduce((acc, d) => acc + d.totalSent, 0);
  const pendingMessages = messages.filter(m => m.status === 'pending' || m.status === 'queued').length;

  const stats = [
    { name: 'Total Devices', value: devices.length, icon: Smartphone, color: 'bg-blue-500' },
    { name: 'Online Devices', value: onlineDevices, icon: Activity, color: 'bg-green-500' },
    { name: 'Messages Sent', value: formatNumber(totalSent), icon: MessageSquare, color: 'bg-purple-500' },
    { name: 'Pending Messages', value: pendingMessages, icon: CreditCard, color: 'bg-yellow-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            SMS Gateway Dashboard
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
            >
              <dt>
                <div className={`absolute rounded-md ${stat.color} p-3`}>
                  <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">
                  {stat.name}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </dd>
            </div>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/devices"
            className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400"
          >
            <div className="flex-shrink-0">
              <Smartphone className="h-8 w-8 text-gray-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="absolute inset-0" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">Manage Devices</p>
              <p className="truncate text-sm text-gray-500">
                View and manage your SMS devices
              </p>
            </div>
          </Link>

          <Link
            href="/messages"
            className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400"
          >
            <div className="flex-shrink-0">
              <MessageSquare className="h-8 w-8 text-gray-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="absolute inset-0" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">Message History</p>
              <p className="truncate text-sm text-gray-500">
                View sent and pending messages
              </p>
            </div>
          </Link>
        </div>

        {/* Recent Messages */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900">Recent Messages</h2>
          <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Phone Numbers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {messages.slice(0, 5).map((message) => (
                  <tr key={message.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          message.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : message.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : message.status === 'sent'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {message.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {message.phoneNumbers.join(', ')}
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-900">
                      {message.textContent}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(message.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
