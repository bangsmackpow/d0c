import Dexie, { type Table } from 'dexie';

export interface LocalDocument {
  id: string;       // Client-generated ULID / UUID
  title: string;
  content: string;     // JSON string representing Tiptap document state
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;   // true if server matches, false if locally modified
}

class DocZeroDatabase extends Dexie {
  documents!: Table<LocalDocument>;

  constructor() {
    super('DocZeroDB');
    this.version(1).stores({
      // Primary key is 'id'. Index other fields if queries are needed.
      documents: 'id, title, isArchived, createdAt, updatedAt, isSynced',
    });
  }
}

export const db = new DocZeroDatabase();
