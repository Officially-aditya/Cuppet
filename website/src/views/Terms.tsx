import LegalDocument from '../components/LegalDocument'
import { termsContent } from '../data/termsContent'

export default function Terms() {
  return (
    <LegalDocument
      title="Terms and Conditions"
      effectiveDate="July 27, 2026"
      lastUpdated="July 27, 2026"
      content={termsContent}
    />
  )
}
