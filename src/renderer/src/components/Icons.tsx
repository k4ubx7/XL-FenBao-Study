interface IconProps {
  name:
    | 'download'
    | 'history'
    | 'settings'
    | 'arrow'
    | 'folder'
    | 'pause'
    | 'retry'
    | 'close'
    | 'spark'
  size?: number
}

const paths: Record<IconProps['name'], React.ReactNode> = {
  download: (
    <>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4.5 4.5-4.5" />
      <path d="M4 18.5h16" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7" />
      <path d="M4 4v4.7h4.7" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.38.38.72.68 1 .3.28.7.42 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h13" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  folder: (
    <path d="M3.5 6.5h6l2-2h9v15h-17z" />
  ),
  pause: (
    <>
      <path d="M8.5 6v12" />
      <path d="M15.5 6v12" />
    </>
  ),
  retry: (
    <>
      <path d="M19 7v5h-5" />
      <path d="M18.2 16a7.5 7.5 0 1 1 .8-8.9L19 12" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.25 4.75L18 9l-4.75 1.25L12 15l-1.25-4.75L6 9l4.75-1.25z" />
      <path d="m18.5 15 .65 2.35 2.35.65-2.35.65L18.5 21l-.65-2.35L15.5 18l2.35-.65z" />
    </>
  )
}

export function Icon({ name, size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {paths[name]}
      </g>
    </svg>
  )
}
