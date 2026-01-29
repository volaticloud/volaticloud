import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'
import AccordionItem from '../ui/AccordionItem'
import Divider from '../ui/Divider'
import { faqItems } from '../../data/content'

export default function FAQSection() {
  return (
    <section className="py-24">
      <Container>
        <SectionHeading
          subtitle="Got questions? We've got answers. If you can't find what you're looking for, reach out to our support team."
        >
          Frequently Asked
          <br />
          Questions
        </SectionHeading>

        <Divider className="mt-10" />

        <div className="mx-auto mt-10 max-w-3xl">
          {faqItems.map((item) => (
            <AccordionItem
              key={item.question}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </div>
      </Container>
    </section>
  )
}
