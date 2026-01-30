import { useState } from 'react'

export default function AccordionItem({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string
  answer: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-white/10">
      <button
        className="flex w-full items-center justify-between gap-4 py-6 px-6 text-left cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xl leading-[28.6px] text-white">
          {question}
        </span>
        <svg
          width="29"
          height="29"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className="accordion-content" data-open={open}>
        <div>
          <p className="px-6 pb-6 text-lg leading-[23.85px] text-[#919191] tracking-tight">
            {answer}
          </p>
        </div>
      </div>
    </div>
  )
}
