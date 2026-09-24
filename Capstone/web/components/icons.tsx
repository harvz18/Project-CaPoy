'use client'

import Icon from '@mdi/react'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Icon>, 'path'> & { path: string }

export function MdiIcon({ path, size = 0.85, ...props }: Props) {
  return <Icon aria-hidden="true" path={path} size={size} {...props} />
}
