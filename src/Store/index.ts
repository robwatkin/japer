import Envelope from '../Envelope'

export class StoreError extends Error {
  constructor(msg: string) {
      super(msg);
      Object.setPrototypeOf(this, StoreError.prototype);
  }
}

export default interface Store {
  exists(key: string, id: string): Promise<boolean>
  read(key: string, id: string): Promise<Envelope|null>
  readMany(key: string): Promise<Envelope[]>
  write (key: string, id: string|null, value: Envelope): Promise<string>
  delete(key: string, id: string): Promise<void>
  setFilter(filter: unknown): unknown
  reset(): Promise<void>
}