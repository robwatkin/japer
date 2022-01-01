export default [
  {
    "operations": [
      {
        "op": "add",
        "path": "/a",
        "value": 1
      },
      {
        "op": "add",
        "path": "/b",
        "value": 2
      }
    ],
    "version": 0
  },
  {
    "operations": [
      {
        "op": "replace",
        "path": "/b",
        "value": 0
      },
      {
        "op": "replace",
        "path": "/a",
        "value": 2
      },
      {
        "op": "add",
        "path": "/c",
        "value": "C"
      }
    ],
    "version": 1
  },
  {
    "operations": [
      {
        "op": "replace",
        "path": "/c",
        "value": "C1"
      },
      {
        "op": "replace",
        "path": "/b",
        "value": 9
      },
      {
        "op": "add",
        "path": "/d",
        "value": {
          "dd": 1
        }
      }
    ],
    "version": 2
  },
  {
    "operations": [
      {
        "op": "add",
        "path": "/d/dc",
        "value": 3
      },
      {
        "op": "replace",
        "path": "/c",
        "value": "foo"
      },
      {
        "op": "remove",
        "path": "/b"
      },
      {
        "op": "replace",
        "path": "/a",
        "value": 1
      }
    ],
    "version": 3
  }
]

// import * as jsonpatch from 'fast-json-patch'

// interface Patch {
//   version: number
//   operations: jsonpatch.Operation[]
// }


// interface Envelope {
//   version: number
//   patches: Patch[]
//   document: {}
// }

// type Store = Record<string, Envelope>

// const store: Store = {
//   dummy: {
//     version: 0,
//     patches: [],
//     document: {}
//   }
// }
// const name = 'dummy'
// const docs = [
//   { a: 1, b: 2 },
//   { a: 2, b: 0, c: 'C' },
//   { a: 2, b: 9, c: 'C1', d: { dd: 1 } },
//   { a: 1, c: 'foo', d: { dd: 1, dc: 3 } }
// ]

// const current = store[name]

// docs.forEach(doc => {
//   const patch: Patch = {
//     operations: jsonpatch.compare(current.document, doc),
//     version: current.version
//   }
//   console.log(',\n', patch)

//   current.patches.push(patch)
//   current.version += 1
//   current.document = doc
// })
