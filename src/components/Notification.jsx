import { useCRM } from '../context/CRMContext'

export default function Notification() {
  const { notif } = useCRM()
  if (!notif) return null
  return (
    <div
      className="notif fixed bottom-5 right-5 bg-[var(--accent)] text-white py-2.5 px-4 rounded-[10px] text-[13.5px] shadow-lg z-[400] opacity-0 translate-y-2 transition-all duration-[0.28s] pointer-events-none max-w-[340px] show:opacity-100 show:translate-y-0"
      style={{ opacity: notif ? 1 : 0, transform: notif ? 'translateY(0)' : 'translateY(8px)' }}
    >
      {typeof notif === 'string' ? notif : <span dangerouslySetInnerHTML={{ __html: notif }} />}
    </div>
  )
}
