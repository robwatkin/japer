import Store from '../Store'
import Envelope from '../Envelope'
import { Patch } from '../patch'

export class MemoryStore implements Store {
  private _store: Map<string, Map<string, Envelope>>
  private _filter?: (envelope: Envelope) => boolean

  constructor() {
    this._store = new Map()
  }

  async exists(key: string, id: string): Promise<boolean> {
    return !!this._store.has(key) && !!this._store.get(key)?.has(id)
  }

  async read(key: string, id: string): Promise<Envelope|null> {
    if (!this._store.has(key)) {
      throw new Error(`document ${key} not found`)
    }
    if (!this._store.get(key)?.has(id)) {
      throw new Error(`document ${key} id: ${id} not found`)
    }

    const values = {...this._store.get(key)?.get(id)}
    const envelope = Envelope.makeEnvelope(id, values)

    if(this._filter && !this._filter(envelope)) {
      return null
    }
    return envelope
  }

  async readMany(key: string): Promise<Envelope[]> {
    if (!this._store.has(key)) {
      throw new Error(`document ${key} not found`)
    }
    const envelopes: Envelope[] = []

    this._store.get(key)?.forEach((v, k) => {
      const envelope = Envelope.makeEnvelope(k, {... v})
      if(!this._filter || (this._filter && this._filter(envelope))) {
        envelopes.push(envelope)
      }
    })
    return envelopes
  }

  async write(key: string, id: string | null, value: Envelope): Promise<string> {
    const randomId = (keyMap: Map<string, Envelope>) => {
      let digits = 1
      while (true) {
        const random = Math.floor(Math.random() * 10 ** digits).toString()
        if (!keyMap.has(random)) {
          return random
        }
        if (digits <= 6) {
          digits++
        }
      }
    }

    if (!this._store.has(key)) {
      this._store.set(key, new Map())
    }
    if (!id) {
      id = randomId(this._store.get(key) as Map<string, Envelope>)
    }
    this._store.get(key)?.set(id, value)
    return id
  }

  async delete(key: string, id: string): Promise<void> {
    if (!this._store.has(key)) {
      throw new Error(`document ${key} not found`)
    }
    if (!this._store.get(key)?.has(id)) {
      throw new Error(`document ${key} id: ${id} not found`)
    }
    this._store.get(key)?.delete(id)
    if (this._store.get(key)?.size === 0) {
      this._store.delete(key)
    }
  }

  async reset(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      this._store.clear()
    } else {
      new Error('Store reset only allowed in test or development mode')
    }
  }

  setFilter(filter: (envelope: Envelope) => boolean): void  {
    this._filter = filter
  }

  // private makeEnvelope (id: string, values: Record<string, unknown>) {
  //   const envelope = new Envelope(values.document as Record<string, unknown>, values.version as number, values.patches as Patch[])
  //   envelope.id = id
  //   envelope.extra = values.extra as Record<string, unknown>
  //   return envelope
  // }
}