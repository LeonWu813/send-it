// Mock for expo-file-system (SDK 54+ File class API + legacy stubs).
// The File class uses jest.fn() for async methods so tests can spy/mockResolvedValue
// directly without needing jest.spyOn on the prototype.

const mockBytes = jest.fn().mockResolvedValue(new Uint8Array(0));
const mockText = jest.fn().mockResolvedValue('');
const mockBase64 = jest.fn().mockResolvedValue('');
const mockExists = jest.fn().mockResolvedValue(true);
const mockDelete = jest.fn().mockResolvedValue(undefined);

class File {
  constructor(uri) {
    this.uri = uri;
    // Instance methods are jest.fn() wrappers pointing to the shared module-level spies.
    // Tests can call e.g. mockBytes.mockResolvedValue(...) or
    // jest.spyOn(expoFileSystemMock, 'mockBytes') before each test.
    this.bytes = mockBytes;
    this.text = mockText;
    this.base64 = mockBase64;
    this.exists = mockExists;
    this.delete = mockDelete;
    this.copy = jest.fn().mockImplementation((destination) => Promise.resolve(new File(destination)));
    this.move = jest.fn().mockImplementation((destination) => Promise.resolve(new File(destination)));
  }
}

// Make bytes accessible as a prototype property for jest.spyOn(File.prototype, 'bytes')
File.prototype.bytes = mockBytes;
File.prototype.text = mockText;
File.prototype.base64 = mockBase64;
File.prototype.exists = mockExists;
File.prototype.delete = mockDelete;

class Directory {
  constructor(uri) {
    this.uri = uri;
  }
  exists() {
    return Promise.resolve(true);
  }
  create() {
    return Promise.resolve();
  }
  delete() {
    return Promise.resolve();
  }
  list() {
    return Promise.resolve([]);
  }
}

// Legacy API (still exported for code that imports from expo-file-system/legacy)
const readAsStringAsync = jest.fn().mockResolvedValue('');
const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
const deleteAsync = jest.fn().mockResolvedValue(undefined);
const getInfoAsync = jest.fn().mockResolvedValue({ exists: true, size: 1024 });
const makeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
const copyAsync = jest.fn().mockResolvedValue(undefined);
const moveAsync = jest.fn().mockResolvedValue(undefined);

const EncodingType = {
  Base64: 'base64',
  UTF8: 'utf8',
};

const documentDirectory = 'file:///documents/';
const cacheDirectory = 'file:///cache/';

module.exports = {
  __esModule: true,
  File,
  Directory,
  mockBytes,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  moveAsync,
  EncodingType,
  documentDirectory,
  cacheDirectory,
};
