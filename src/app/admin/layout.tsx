import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex gap-4 border-b border-gray-200 pb-4">
        <Link
          href="/admin/users"
          className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
        >
          Users
        </Link>
        <Link
          href="/admin/settings"
          className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
        >
          Settings
        </Link>
        <Link
          href="/admin/sync"
          className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
        >
          Price Sync
        </Link>
      </div>
      {children}
    </div>
  )
}
