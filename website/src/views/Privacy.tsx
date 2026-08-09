import LegalDocument from '../components/LegalDocument'
import { privacyContent } from '../data/privacyContent'

export default function Privacy() {
  return (
    <LegalDocument
      title="Privacy Policy"
      effectiveDate="July 27, 2026"
      lastUpdated="July 27, 2026"
      content={privacyContent}
    />
  )
}
