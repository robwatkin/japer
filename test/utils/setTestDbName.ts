import path from 'path'

export const setTestDbName = (filePath: string): string => {
  const testParentFolder = path.dirname(filePath).split('/').pop()
  const testName = 'japer-testdb-' +
    (testParentFolder !== 'japer' ? testParentFolder + '-' : '') +
    path.basename(filePath).split('.')[0]
  process.env.MONGO_DATABASE = testName
  console.log(`dbName ${testName}`)
  return testName
}
