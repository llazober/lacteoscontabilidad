import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Connecting to database using Prisma 7 adapter...');
  const count = await prisma.cuentaContable.count();
  console.log(`Success! Current number of Accounts in contabilidad schema: ${count}`);
  const provCount = await prisma.proveedor.count();
  console.log(`Success! Current number of Suppliers in public schema: ${provCount}`);
}

main()
  .catch((e) => {
    console.error('Error connecting to database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
