import * as fs from 'fs/promises'
import path from 'path'

// TODO need unit tests for Filer

type StringOrMap = string | Map<string, any>

interface SerializedMap {
  dataType: string,
  value: any[]
}

export default class Filer {
  private _dirPath: string
  private _filePath: string

  constructor(filename: string) {
    this._dirPath = path.join(process.cwd(), 'store')
    this._filePath = path.join(this._dirPath, filename)
  }

  async read(): Promise<StringOrMap> {
    try {
      await this.makeStore()
      const file = await fs.readFile(this._filePath)
      const result = JSON.parse(file.toString(), this.reviver)

      return result
    } catch (error: unknown) { }
    return new Map()
  }

  async write(object: StringOrMap) {
    await this.makeStore()
    await fs.writeFile(this._filePath, JSON.stringify(object, this.replacer, 2))
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

  private async makeStore() {
    console.log(`makeStore...`)
    await fs.stat(this._dirPath).catch(async () => {
      console.log(`mkdir ${this._dirPath}`)
      await fs.mkdir(this._dirPath).catch(() => null)
    })
    console.log(`makeStore done`)

  }
}