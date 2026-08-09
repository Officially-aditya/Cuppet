'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const SMOOTH_TAU = 0.25
const MIN_COPIES = 2
const COPY_HEADROOM = 2

type LogoLoopProps = {
  logos: { node: ReactNode }[]
  speed?: number
  logoHeight?: number
  gap?: number
  hoverSpeed?: number
  scaleOnHover?: boolean
  ariaLabel?: string
}

type LoopStyle = CSSProperties & {
  '--connector-loop-gap': string
  '--connector-loop-logo-height': string
}

export default function LogoLoop({
  logos,
  speed = 120,
  logoHeight = 28,
  gap = 32,
  hoverSpeed = 0,
  scaleOnHover = false,
  ariaLabel = 'Partner logos',
}: LogoLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const sequenceRef = useRef<HTMLUListElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number | null>(null)
  const offsetRef = useRef(0)
  const velocityRef = useRef(0)
  const [sequenceWidth, setSequenceWidth] = useState(0)
  const [copyCount, setCopyCount] = useState(MIN_COPIES)
  const [isHovered, setIsHovered] = useState(false)

  const measure = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0
    const measuredWidth = sequenceRef.current?.getBoundingClientRect().width ?? 0
    if (measuredWidth <= 0) return

    setSequenceWidth(Math.ceil(measuredWidth))
    setCopyCount(Math.max(MIN_COPIES, Math.ceil(containerWidth / measuredWidth) + COPY_HEADROOM))
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const sequence = sequenceRef.current
    if (!container) return

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    if (sequence) observer.observe(sequence)
    return () => observer.disconnect()
  }, [gap, logoHeight, logos, measure])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    if (sequenceWidth > 0) {
      offsetRef.current = ((offsetRef.current % sequenceWidth) + sequenceWidth) % sequenceWidth
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
    }

    const animate = (timestamp: number) => {
      if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp
      const delta = Math.max(0, timestamp - lastTimestampRef.current) / 1000
      lastTimestampRef.current = timestamp
      const target = isHovered ? hoverSpeed : Math.abs(speed)
      velocityRef.current +=
        (target - velocityRef.current) * (1 - Math.exp(-delta / SMOOTH_TAU))

      if (sequenceWidth > 0) {
        offsetRef.current =
          ((offsetRef.current + velocityRef.current * delta) % sequenceWidth + sequenceWidth) %
          sequenceWidth
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
      lastTimestampRef.current = null
    }
  }, [hoverSpeed, isHovered, sequenceWidth, speed])

  const style: LoopStyle = {
    '--connector-loop-gap': `${gap}px`,
    '--connector-loop-logo-height': `${logoHeight}px`,
  }

  return (
    <div
      ref={containerRef}
      className={`connector-logo-loop${scaleOnHover ? ' connector-logo-loop--scale' : ''}`}
      style={style}
      role="region"
      aria-label={ariaLabel}
    >
      <div
        ref={trackRef}
        className="connector-logo-loop__track"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {Array.from({ length: copyCount }, (_, copyIndex) => (
          <ul
            key={copyIndex}
            ref={copyIndex === 0 ? sequenceRef : undefined}
            className="connector-logo-loop__list"
            aria-hidden={copyIndex > 0}
          >
            {logos.map((logo, logoIndex) => (
              <li key={`${copyIndex}-${logoIndex}`} className="connector-logo-loop__item">
                <span className="connector-logo-loop__node">{logo.node}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
