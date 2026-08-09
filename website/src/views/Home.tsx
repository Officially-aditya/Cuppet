import SiteLayout from '../components/SiteLayout'
import Hero from '../sections/Hero'
import Connectors from '../sections/Connectors'
import Walkthrough from '../sections/Walkthrough'
import Security from '../sections/Security'
import Examples from '../sections/Examples'
import FAQ from '../sections/FAQ'
import CTA from '../sections/CTA'

export default function Home() {
  return (
    <SiteLayout>
      <main>
        <Hero />
        <Connectors />
        <Walkthrough />
        <Security />
        <Examples />
        <FAQ />
        <CTA />
      </main>
    </SiteLayout>
  )
}
