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
  const { data, error } = await supabase.from('daily_complaints_view').select('*').limit(5);
  if (error) {
    console.error('Error fetching view:', error.message);
  } else {
    console.log('Successfully fetched view data:', data);
  }
}

test();
