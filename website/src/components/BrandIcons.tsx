import type { IconBaseProps } from 'react-icons'

/** The official three-color Google Drive mark. */
export function GoogleDriveIcon({ size = '1em', title, ...props }: IconBaseProps) {
  return (
    <svg
      {...props}
      aria-hidden={title ? undefined : true}
      focusable="false"
      height={size}
      role={title ? 'img' : undefined}
      viewBox="0 0 16 16"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="#4285F4"
        d="M6.844 10 3.96 15h9.072l2.884-5H6.844Z"
      />
      <path
        fill="#FABC04"
        d="m15.506 9-4.619-8H5.112l4.619 8h5.775Z"
      />
      <path
        fill="#0F9D58"
        d="M4.534 2 0 9.856l2.888 5 4.534-7.856L4.534 2Z"
      />
    </svg>
  )
}
