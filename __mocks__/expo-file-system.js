const FileSystem = {
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
};
module.exports = FileSystem;
