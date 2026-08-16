import { createServiceClient } from '../utils/supabase/service';
import * as fs from 'fs';
import * as path from 'path';

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
      return;
    }
  }
}

loadEnv();

async function test() {
  const supabase = createServiceClient();

  // Test factory filter (via orders -> batch -> factory_id)
  {
    const { data, error, count } = await supabase
      .from('review')
      .select('*, orders!inner(batch!inner(factory_id))', { count: 'exact' })
      .eq('orders.batch.factory_id', 'fact-c')
      .limit(5);

    if (error) {
      console.error('Factory filter error:', error.message);
    } else {
      console.log('Factory filter success, count:', count, 'data sample:', data);
    }
  }

  // Test warehouse filter (via orders -> warehouse_id)
  {
    const { data, error, count } = await supabase
      .from('review')
      .select('*, orders!inner(warehouse_id)', { count: 'exact' })
      .eq('orders.warehouse_id', 'wh-south')
      .limit(5);

    if (error) {
      console.error('Warehouse filter error:', error.message);
    } else {
      console.log('Warehouse filter success, count:', count, 'data sample:', data);
    }
  }

  // Test courier filter (via orders -> shipment -> courier_id)
  {
    const { data, error, count } = await supabase
      .from('review')
      .select('*, orders!inner(shipment!inner(courier_id))', { count: 'exact' })
      .eq('orders.shipment.courier_id', 'cour-fast')
      .limit(5);

    if (error) {
      console.error('Courier filter error:', error.message);
    } else {
      console.log('Courier filter success, count:', count, 'data sample:', data);
    }
  }
}

test();
