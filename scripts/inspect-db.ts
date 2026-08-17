import * as fs from 'fs';
import * as path from 'path';
import { createServiceClient } from '../utils/supabase/service';

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

async function run() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('complaint_prediction').select('complaint_type, confidence').limit(15);
  if (error) {
    console.error('Error querying:', error);
  } else {
    console.log('Query results:', data);
  }
}

run().catch(console.error);
