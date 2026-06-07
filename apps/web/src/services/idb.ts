import Dexie, { type Table } from 'dexie';

export interface LocalSpace {
  id: string;        // Client-generated ULID / UUID
  name: string;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean; // true if server matches, false if locally modified
}

export interface LocalDocument {
  id: string;       // Client-generated ULID / UUID
  title: string;
  content: string;     // JSON string representing Tiptap document state
  spaceId: string | null; // Associated space ID
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;   // true if server matches, false if locally modified
}

class DocZeroDatabase extends Dexie {
  documents!: Table<LocalDocument>;
  spaces!: Table<LocalSpace>;

  constructor() {
    super('DocZeroDB');
    this.version(1).stores({
      documents: 'id, title, isArchived, createdAt, updatedAt, isSynced',
    });
    this.version(2).stores({
      documents: 'id, title, spaceId, isArchived, createdAt, updatedAt, isSynced',
      spaces: 'id, name, createdAt, updatedAt, isSynced',
    });
  }
}

export const db = new DocZeroDatabase();

