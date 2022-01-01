import { Patch, Operation } from './patch'

export default class Envelope {
  patches?: Patch[]
  id?: string
  version: number
  document: Record<string, unknown>
  extra?: Record<string, unknown>

  constructor (document: Record<string, unknown>, version = 0, patches: Patch[] = []) {
      if(version > 0 && patches.length === 0) {
      throw new Error('Non zero version must have patches')
    }
    this.version = version
    this.patches = patches
    this.document = document
    this.extra = {}
  }

  addPatch (patch: Patch) {
    if(!this.patches) {
      throw new Error('Missing array patches')
    }
    this.patches.push(patch)
  }

  getPatchesFromVersion(version: number): Patch[] {
    if(!this.patches) {
      throw new Error('Missing array patches')
    }
    const patches: Patch[] | undefined = this.patches.filter(p => p.version >= version)

    if (version > 0 && (!patches || patches.length === 0)) {
      throw new Error(`patch version ${version} not found`)
    }
    return patches
  }

  static makeEnvelope (id: string, values: Record<string, unknown>) {
    const envelope = new Envelope(values.document as Record<string, unknown>, values.version as number, values.patches as Patch[])
    envelope.id = id
    envelope.extra = values.extra as Record<string, unknown>
    return envelope
  }
}