import * as fs from 'fs';
import * as path from 'path';
import { createServiceClient } from '../utils/supabase/service';
import { generateCoreDataset } from '../utils/data-generator';

function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let value = parts.slice(1).join('=').trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.log(`Loaded environment variables from ${envPath}`);
      return;
    }
  }
}

loadEnv();

async function run() {
  console.log('Starting Supabase ingestion...');
  const supabase = createServiceClient();

  const data = await generateCoreDataset(15000);

  console.log('Inserting base entities...');
  
  const { error: factoriesError } = await supabase.from('factory').upsert(data.FACTORIES, { onConflict: 'factory_id' });
  if (factoriesError) throw factoriesError;
  console.log('Factories inserted');

  const { error: warehousesError } = await supabase.from('warehouse').upsert(data.WAREHOUSES, { onConflict: 'warehouse_id' });
  if (warehousesError) throw warehousesError;
  console.log('Warehouses inserted');

  const { error: couriersError } = await supabase.from('courier').upsert(data.COURIERS, { onConflict: 'courier_id' });
  if (couriersError) throw couriersError;
  console.log('Couriers inserted');

  console.log(`Ingesting ${data.formattedProducts.length} products...`);
  for (let i = 0; i < data.formattedProducts.length; i += 1000) {
    const chunk = data.formattedProducts.slice(i, i + 1000);
    const { error } = await supabase.from('product').upsert(chunk);
    if (error) throw error;
  }
  console.log('Products ingested');

  console.log(`Ingesting ${data.batchesList.length} batches...`);
  for (let i = 0; i < data.batchesList.length; i += 1000) {
    const chunk = data.batchesList.slice(i, i + 1000);
    const { error } = await supabase.from('batch').upsert(chunk);
    if (error) throw error;
  }
  console.log('Batches ingested');

  console.log(`Ingesting ${data.formattedOrders.length} orders...`);
  for (let i = 0; i < data.formattedOrders.length; i += 1000) {
    const chunk = data.formattedOrders.slice(i, i + 1000);
    const { error } = await supabase.from('orders').upsert(chunk);
    if (error) throw error;
  }
  console.log('Orders ingested');

  console.log(`Ingesting ${data.shipmentsList.length} shipments...`);
  for (let i = 0; i < data.shipmentsList.length; i += 1000) {
    const chunk = data.shipmentsList.slice(i, i + 1000);
    const { error } = await supabase.from('shipment').upsert(chunk);
    if (error) throw error;
  }
  console.log('Shipments ingested');

  console.log(`Ingesting ${data.reviewsList.length} reviews with incident injection...`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const reviewsToInsert = data.reviewsList.map(({ _original_creation_date, ...rest }) => rest);
  for (let i = 0; i < reviewsToInsert.length; i += 1000) {
    const chunk = reviewsToInsert.slice(i, i + 1000);
    const { error } = await supabase.from('review').upsert(chunk);
    if (error) throw error;
  }
  console.log('Reviews ingested');

  console.log('Ingesting ground-truth incidents...');
  const { error: incidentError } = await supabase.from('incidents').insert(data.INCIDENTS);
  if (incidentError) throw incidentError;
  console.log('Ground truth incidents inserted');

  console.log('Data ingestion complete!');
}

run().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
