/**
 * Tab navigation component for settings sections
 */

'use client'

import { ReactNode } from 'react'
import { FiSettings, FiImage, FiSend, FiDollarSign } from 'react-icons/fi'

export type SettingsTab = 'general' | 'branding' | 'delivery' | 'billing'

interface SettingsTabsProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  children: ReactNode
}

export function SettingsTabs({ activeTab, onTabChange, children }: SettingsTabsProps) {
  const tabs: { id: SettingsTab; label: string; icon: typeof FiSettings }[] = [
    { id: 'general', label: 'General', icon: FiSettings },
    { id: 'branding', label: 'Branding', icon: FiImage },
    { id: 'delivery', label: 'Delivery', icon: FiSend },
    { id: 'billing', label: 'Billing & Usage', icon: FiDollarSign },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 overflow-x-auto">
        <nav className="flex space-x-4 sm:space-x-8 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="inline w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  )
}

