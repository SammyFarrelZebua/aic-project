import * as fs from 'fs';
import * as path from 'path';
import { createServiceClient } from '../utils/supabase/service';
import { DATA_DIR } from '../utils/data-generator';

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

function formatCSVCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val);
  str = str.replace(/[\r\n]+/g, ' ');

  if (/^[=\+\-@\t]/.test(str) && isNaN(Number(str))) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(',') || /^\s|\s$/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(arr: Record<string, unknown>[]): string {
  if (arr.length === 0) return '';
  const headers = Object.keys(arr[0]);
  const csvLines = [headers.join(',')];
  for (const row of arr) {
    const line = headers.map(h => formatCSVCell(row[h])).join(',');
    csvLines.push(line);
  }
  return csvLines.join('\n');
}

// Field order must exactly match scripts/generate-local-dataset.ts flatRecords.
const EXPORT_FIELDS = [
  'review_id',
  'review_score',
  'review_comment_title',
  'review_comment_message',
  'review_creation_date',
  'order_id',
  'order_status',
  'order_purchase_timestamp',
  'order_delivered_customer_date',
  'item_price',
  'item_freight_value',
  'product_id',
  'product_category',
  'batch_id',
  'batch_production_date',
  'factory_id',
  'factory_name',
  'factory_region',
  'shipment_id',
  'shipment_date',
  'shipment_delivery_date',
  'warehouse_id',
  'warehouse_name',
  'warehouse_region',
  'courier_id',
  'courier_name',
  'courier_region',
  'ground_truth_incident'
] as const;

async function run() {
  console.log('Starting Supabase dataset export...');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const supabase = createServiceClient();

  // Paginate over analytics_traceability_view (Supabase caps at 1000 rows per request).
  const pageSize = 1000;
  const records: Record<string, unknown>[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('analytics_traceability_view')
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    // Force the view column order and add ground_truth_incident = null.
    for (const row of data) {
      const flat: Record<string, unknown> = {};
      for (const field of EXPORT_FIELDS) {
        if (field === 'ground_truth_incident') {
          flat[field] = null;
        } else {
          flat[field] = (row as Record<string, unknown>)[field] ?? null;
        }
      }
      records.push(flat);
    }

    console.log(`Fetched ${records.length} records so far...`);
    if (data.length < pageSize) break;
  }

  console.log(`Total records exported from database: ${records.length}`);

  const outputData = {
    incidents: [] as unknown[],
    records
  };

  const jsonPath = path.join(DATA_DIR, 'analytics_traceability_dataset.json');
  fs.writeFileSync(jsonPath, JSON.stringify(outputData, null, 2));

  const csvPath = path.join(DATA_DIR, 'analytics_traceability_dataset.csv');
  fs.writeFileSync(csvPath, arrayToCSV(records));

  const incidentsCsvPath = path.join(DATA_DIR, 'ground_truth_incidents.csv');
  // Empty ground-truth: fresh operational data has no injected incidents.
  const emptyIncidents = [] as Record<string, unknown>[];
  fs.writeFileSync(incidentsCsvPath, arrayToCSV(emptyIncidents));

  console.log(`Dataset exported successfully to ${jsonPath}`);
  console.log(`CSV exported successfully to ${csvPath}`);
  console.log(`Empty ground-truth CSV written to ${incidentsCsvPath}`);
}

run().catch(err => {
  console.error('Supabase dataset export failed:', err);
  process.exit(1);
});
