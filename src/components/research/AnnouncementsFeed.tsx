import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/formatters'

interface Announcement {
  asxId: string
  title: string
  url: string
  marketSensitive: boolean
  releasedAt: Date | string
  category: string | null
}

export function AnnouncementsFeed({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        No announcements found
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {announcements.map((ann) => (
        <div key={ann.asxId} className="py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <a
              href={ann.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-indigo-600 leading-snug block"
            >
              {ann.title}
            </a>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">{formatDate(ann.releasedAt)}</span>
              {ann.category && (
                <span className="text-xs text-gray-400">{ann.category}</span>
              )}
              {ann.marketSensitive && (
                <Badge variant="red">Market Sensitive</Badge>
              )}
            </div>
          </div>
          <a
            href={ann.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            PDF →
          </a>
        </div>
      ))}
    </div>
  )
}
