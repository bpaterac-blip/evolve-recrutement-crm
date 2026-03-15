import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { STAGES, STAGE_COLORS } from '../lib/data'

function KanbanCard({ p, stage, onClick }) {
  const c = STAGE_COLORS[stage] || {}
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: p.id,
    data: { profile: p, fromStage: stage },
  })
  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`kc bg-[var(--surface)] border border-[var(--border)] rounded-lg py-2.5 px-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:-translate-y-px ${isDragging ? 'opacity-50' : ''}`}
      style={{ borderLeft: `3px solid ${c.text}` }}
      onClick={(e) => { e.stopPropagation(); onClick(p) }}
    >
      <div className="kcn font-medium text-[13px]">{p.fn} {p.ln}</div>
      <div className="kcc text-[11.5px] text-[var(--t3)] mt-0.5">{p.co} · {p.city}</div>
      {p.integ && p.integ !== '—' && <div className="text-[11px] text-[var(--accent)] mt-1">📅 {p.integ}</div>}
      <div className="kcf flex items-center justify-between mt-2">
        <span className="kcd text-[11px] text-[var(--t3)]">{p.dt}</span>
        {stage !== 'Recruté' ? <button type="button" className="kbtn text-[11px] py-0.5 px-2 rounded-md bg-[var(--s2)] text-[var(--accent)] border-none cursor-pointer font-medium hover:bg-[var(--border)]" onClick={(e) => { e.stopPropagation(); }}>+ RDV</button> : <span className="tag tg text-[10px]">Intégré ✓</span>}
      </div>
    </div>
  )
}

function DroppableColumn({ stage, cards, onCardClick }) {
  const c = STAGE_COLORS[stage] || {}
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}`, data: { stage } })

  return (
    <div ref={setNodeRef} className={`kcol w-[215px] shrink-0 flex flex-col gap-1.5 ${isOver ? 'ring-2 ring-[var(--accent)] rounded-lg' : ''}`}>
      <div className="kch flex items-center justify-between py-2 px-3 rounded-lg text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
        <span>{stage}</span>
        <span className="bg-white/60 py-0.5 px-1.5 rounded-[10px] text-[11px]">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[80px]">
        {cards.map((p) => (
          <KanbanCard key={p.id} p={p} stage={stage} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const navigate = useNavigate()
  const { filteredProfiles, changeStage } = useCRM()
  const pipeline = filteredProfiles.filter((p) => p.stg !== 'Recruté')
  const all = filteredProfiles

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over?.data?.current?.stage) return
    const newStage = over.data.current.stage
    const profile = active.data.current?.profile
    if (!profile || profile.stg === newStage) return
    changeStage(profile.id, newStage)
  }

  return (
    <div id="pg-pipeline" className="h-full flex flex-col overflow-hidden">
      <div className="pipbar py-4 px-5 pt-4 flex items-center gap-3 shrink-0">
        <div className="font-semibold text-sm">Pipeline recrutement — vue Kanban</div>
        <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{pipeline.length} profils actifs</span>
        <button type="button" className="btn bp bsm py-1.5 px-2.5 text-xs ml-auto" onClick={() => window.dispatchEvent(new CustomEvent('open-new-profile'))}>+ Nouveau profil</button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="kb flex gap-3 py-3.5 px-5 pb-5 overflow-x-auto flex-1 items-start">
          {STAGES.map((st) => {
            const cards = all.filter((p) => p.stg === st)
            return (
              <DroppableColumn
                key={st}
                stage={st}
                cards={cards}
                onCardClick={(p) => navigate(`/profiles/${p.id}`)}
              />
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}
