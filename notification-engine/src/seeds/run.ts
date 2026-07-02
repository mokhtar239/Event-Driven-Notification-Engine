import 'dotenv/config';
import mongoose from 'mongoose';
import { seedTemplates } from './templates.seed';
import { seedData } from './data.seed';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
  await seedTemplates(mongoose.connection);
  await seedData(mongoose.connection);
  await mongoose.disconnect();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
