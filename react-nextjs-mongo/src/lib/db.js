/**
 * Mongoose Connection Singleton for Next.js
 *
 * Next.js API routes are serverless-style: each request may create a new
 * module context. Without caching, every request would open a new MongoDB
 * connection. We cache the connection on `global` to reuse it across
 * hot reloads in development and across requests in production.
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/projectmanager';

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (global.mongoose.conn) {
    return global.mongoose.conn;
  }

  if (!global.mongoose.promise) {
    global.mongoose.promise = mongoose.connect(MONGODB_URI).then((m) => {
      console.log(`MongoDB Connected: ${m.connection.host}`);
      return m;
    });
  }

  global.mongoose.conn = await global.mongoose.promise;
  return global.mongoose.conn;
}

export default connectDB;
