import { Skeleton } from 'aify'

export function Default() {
  return <Skeleton />
}

export function Avatar() {
  return <Skeleton width={52} height={52} borderRadius={999} />
}

export function TextLine() {
  return <Skeleton width="60%" height={12} />
}
