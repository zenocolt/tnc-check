import 'dotenv/config';
import mongoose from 'mongoose';

const dbName = process.env.MONGODB_DB_NAME || 'tnc-check1';

export async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in environment.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

export function getCollection(name) {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error('Database connection is not ready.');
  }

  return database.collection(name);
}

export function toObjectId(value) {
  return new mongoose.Types.ObjectId(value);
}

export { mongoose, dbName };