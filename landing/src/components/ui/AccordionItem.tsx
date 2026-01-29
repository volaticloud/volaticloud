import { useState } from 'react'
import Icon from './Icon'

export default function AccordionItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-800/60">
      <button
        className="flex w-full items-center justify-between gap-4 py-5 text-left cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[15px] font-medium text-gray-200 group-hover:text-white transition-colors">
          {question}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {/* Green accent dot */}
          <div className={`h-1.5 w-1.5 rounded-full transition-colors ${open ? 'bg-green-500' : 'bg-gray-700'}`} />
          <Icon
            name="chevron-down"
            size={18}
            className={`text-gray-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <div
        className="accordion-content"
        data-open={open}
      >
        <div>
          <p className="pb-5 text-sm leading-relaxed text-gray-500">{answer}</p>
        </div>
      </div>
    </div>
  )
}
