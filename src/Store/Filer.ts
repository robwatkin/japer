import * as fs from 'fs/promises'
import path from 'path'

// TODO need unit tests for Filer

type StringOrMap = string | Map<string, any>

interface SerializedMap {
  dataType: string,
  value: any[]
}

export default class Filer {
  private _filepath: string

  constructor(filename: string) {
    this._filepath = path.join(process.cwd(), 'store', filename)
  }

  async read(): Promise<StringOrMap> {
    try {
      const file = await fs.readFile(this._filepath)
      const result = JSON.parse(file.toString(), this.reviver)

      return result
    } catch (error: unknown) { }
    return new Map()
  }

  async write(object: StringOrMap) {
    await fs.writeFile(this._filepath, JSON.stringify(object, this.replacer, 2))
  }

  private replacer(key: string, value: StringOrMap) {
    if (value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries()), // or with spread: value: [...value]
      };
    } else {
      return value;
    }
  }

  private reviver(key: string, value: SerializedMap) {
    if (typeof value === 'object' && value !== null) {
      if (value.dataType === 'Map') {
        return new Map(value.value);
      }
    }
    return value;
  }
}