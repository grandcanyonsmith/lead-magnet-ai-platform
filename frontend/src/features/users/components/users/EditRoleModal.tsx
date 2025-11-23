'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { FiChevronDown, FiCheck } from 'react-icons/fi'
import { User, ROLES, RoleOption } from '../../types'
import { getRoleOption } from '../../utils/userUtils'

interface EditRoleModalProps {
  isOpen: boolean
  user: User | null
  onClose: () => void
  onSave: (user: User, role: string) => Promise<void>
  isSaving?: boolean
}

export function EditRoleModal({ isOpen, user, onClose, onSave, isSaving = false }: EditRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null)

  useEffect(() => {
    if (user) {
      setSelectedRole(getRoleOption(user.role))
    }
  }, [user])

  const handleSave = async () => {
    if (!user || !selectedRole) return
    await onSave(user, selectedRole.value)
    onClose()
  }

  const handleClose = () => {
    setSelectedRole(null)
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-4 sm:p-6 shadow-soft border border-white/60 transition-all">
                <Dialog.Title
                  as="h2"
                  className="text-lg sm:text-xl font-bold text-ink-900 mb-4"
                >
                  Edit User Role
                </Dialog.Title>

                {user && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-ink-600 mb-2">
                        <strong>User:</strong> {user.name || user.email}
                      </p>
                      <p className="text-sm text-ink-600">
                        <strong>Current Role:</strong> {user.role}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-2">
                        New Role
                      </label>
                      <Listbox value={selectedRole} onChange={setSelectedRole}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-default rounded-2xl bg-white/90 py-2.5 sm:py-2 pl-3 pr-10 text-left text-base sm:text-sm border border-white/60 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors">
                            <span className="block truncate flex items-center gap-2">
                              {selectedRole && (
                                <>
                                  {(() => {
                                    const Icon = selectedRole.icon
                                    return <Icon className={`w-4 h-4 ${selectedRole.color}`} />
                                  })()}
                                  <span>{selectedRole.label}</span>
                                </>
                              )}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <FiChevronDown
                                className="h-4 w-4 text-ink-400"
                                aria-hidden="true"
                              />
                            </span>
                          </Listbox.Button>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-2xl bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm border border-white/60">
                              {ROLES.map((roleOption) => (
                                <Listbox.Option
                                  key={roleOption.value}
                                  className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                                      active ? 'bg-brand-50 text-brand-900' : 'text-ink-900'
                                    }`
                                  }
                                  value={roleOption}
                                >
                                  {({ selected }) => (
                                    <>
                                      <span
                                        className={`block truncate flex items-center gap-2 ${
                                          selected ? 'font-medium' : 'font-normal'
                                        }`}
                                      >
                                        {(() => {
                                          const Icon = roleOption.icon
                                          return <Icon className={`w-4 h-4 ${roleOption.color}`} />
                                        })()}
                                        <span>{roleOption.label}</span>
                                      </span>
                                      {selected ? (
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-600">
                                          <FiCheck className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving || !selectedRole || selectedRole.value === user.role}
                        className="flex-1 bg-brand-600 text-white px-4 py-2.5 sm:py-2 rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-soft touch-target font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 bg-white border border-white/60 text-ink-700 px-4 py-2.5 sm:py-2 rounded-2xl hover:bg-white/90 transition-colors shadow-soft touch-target font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

