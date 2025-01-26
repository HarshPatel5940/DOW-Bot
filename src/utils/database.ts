import { type Db, MongoClient } from 'mongodb';
import config from '../config';

let db: Db;

async function initializeClient(): Promise<Db> {
  const client = await MongoClient.connect(config.DB_URI);

  return client.db();
}

export default async (): Promise<Db> => {
  if (!db) {
    db = await initializeClient();
  }
  return db;
};

export async function initDbCollections() {
  if (!db) {
    db = await initializeClient();
  }

  const collections = await db.collections();
  const myCollections = ['users', 'matches', 'leagues'];

  for (const collection of myCollections) {
    if (!collections.map(c => c.collectionName).includes(collection)) {
      await db.createCollection(collection);
      console.log(`Database ${collection} Collections Created!`);
    }
  }

  console.log('Database Ready!');
}
