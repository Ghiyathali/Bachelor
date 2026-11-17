import { useEffect, useRef, useState } from 'react'

// Measures the width of an element and updates it whenever the element is resized. The D3 charts
// use it to redraw at the right size, because an SVG needs its width in numbers, not in CSS.
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateWidth = (nextWidth: number) => {
      setWidth(Math.max(0, Math.floor(nextWidth)))
    }

    updateWidth(element.getBoundingClientRect().width)

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
