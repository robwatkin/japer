import { Operation } from 'fast-json-patch'

interface Patch {
  version: number
  operations: Operation[]
}

export { Patch, Operation }
