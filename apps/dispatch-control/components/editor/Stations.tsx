import type { StationVM } from '@/lib/editorState'
import StatusWord, { StatusMarker } from './StatusWord'

function markerFor(s: StationVM) {
  return s.complete ? 'check' : s.current ? 'ring' : 'hollow'
}

export default function Stations({ stations }: { stations: StationVM[] }) {
  const currentIdx = stations.findIndex((s) => s.current)
  return (
    <ol aria-label="Progress on this issue" className="grid grid-cols-1 sm:grid-cols-4">
      {stations.map((s, i) => {
        const first = i === 0
        const last = i === stations.length - 1
        // left connector: previous station complete; right connector: this station complete
        const leftOn = !first && stations[i - 1]?.complete === true
        const rightOn = !last && s.complete
        const afterCurrent = currentIdx >= 0 && i > currentIdx
        return (
          <li
            key={s.name}
            aria-current={s.current ? 'step' : undefined}
            className="flex sm:flex-col items-start sm:items-stretch gap-4 sm:gap-3 min-h-[56px]"
          >
            {/* phone: marker + vertical connector */}
            <div className="flex flex-col items-center self-stretch sm:hidden">
              <StatusMarker marker={markerFor(s)} size={30} fill="cobalt" />
              <span
                aria-hidden="true"
                className="w-[2px] flex-1 min-h-[16px]"
                style={{ background: !last && s.complete ? 'var(--color-cobalt)' : 'transparent' }}
              />
            </div>
            {/* sm+: connector - marker - connector */}
            <div className="hidden sm:flex items-center">
              <span
                aria-hidden="true"
                className="h-[2px] flex-1"
                style={{ background: leftOn && !afterCurrent ? 'var(--color-cobalt)' : 'transparent' }}
              />
              <StatusMarker marker={markerFor(s)} size={30} fill="cobalt" />
              <span
                aria-hidden="true"
                className="h-[2px] flex-1"
                style={{ background: rightOn ? 'var(--color-cobalt)' : 'transparent' }}
              />
            </div>
            <div className="sm:text-center pb-2">
              <p className="font-[family-name:var(--font-ui)] text-[17px] font-semibold">{s.name}</p>
              <StatusWord word={s.word} text={s.line} hideMarker />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
