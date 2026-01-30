import Container from '../ui/Container'
import AccordionItem from '../ui/AccordionItem'
import { faqItems } from '../../data/content'

export default function FAQSection() {
  return (
    <section className="py-24" id="faq">
      <Container>
        <div className="mx-auto max-w-[892px]">
          <div className="text-center">
            <h2 className="mx-auto max-w-[556px] text-[64px] font-bold leading-tight text-white">
              Frequently Asked Questions
            </h2>
            <p className="mt-6 text-xl leading-[28.6px] text-[#d9d9d9]">
              Got questions? We've got answers. Find everything you need to know about using our platform, plans, and features.
            </p>
          </div>

          <div className="mt-16">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
