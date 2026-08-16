import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR, generateCoreDataset } from '../utils/data-generator';

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

async function run() {
  console.log('Starting offline dataset generation...');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const data = await generateCoreDataset(15000);
  const flatRecords: Record<string, unknown>[] = [];

  data.reviewsList.forEach(r => {
    const order = data.formattedOrders.find(o => o.order_id === r.order_id);
    if (!order) return;

    const shipment = data.shipmentsList.find(s => s.order_id === r.order_id);
    const batchIdFromOrder = order.batch_id || (data.orderItemsMap[r.order_id] ? data.orderItemsMap[r.order_id].batch_id : null);
    
    const batch = batchIdFromOrder ? data.uniqueBatches[`${order.product_id}_${data.orderDateMap[r.order_id] ? `${new Date(data.orderDateMap[r.order_id]).getFullYear()}-${new Date(data.orderDateMap[r.order_id]).getMonth() + 1}` : ''}`] || data.batchesList.find(b => b.batch_id === batchIdFromOrder) : null;
    const factoryId = batch ? batch.factory_id : null;
    const fact = data.FACTORIES.find(f => f.factory_id === factoryId);

    const warehouse = order.warehouse_id ? data.WAREHOUSES.find(w => w.warehouse_id === order.warehouse_id) : null;
    const courier = shipment ? data.COURIERS.find(c => c.courier_id === shipment.courier_id) : null;

    const product = data.formattedProducts.find(p => p.product_id === order.product_id);

    flatRecords.push({
      review_id: r.review_id,
      review_score: r.rating,
      review_comment_title: null,
      review_comment_message: r.review_text || null,
      review_creation_date: r._original_creation_date,
      order_id: r.order_id,
      order_status: data.orderStatusMap[r.order_id],
      order_purchase_timestamp: data.orderDateMap[r.order_id],
      order_delivered_customer_date: data.orderDeliveredDateMap[r.order_id],
      item_price: product ? product.price : null,
      item_freight_value: product ? data.productFreight[product.product_id] : null,
      product_id: product ? product.product_id : null,
      product_category: product ? product.category : null,
      batch_id: batch ? batch.batch_id : null,
      batch_production_date: batch ? batch.production_date : null,
      factory_id: fact ? fact.factory_id : null,
      factory_name: fact ? fact.factory_name : null,
      factory_region: fact ? fact.province : null,
      shipment_id: shipment ? shipment.shipment_id : null,
      shipment_date: shipment ? shipment.ship_date : null,
      shipment_delivery_date: shipment ? shipment.delivery_date : null,
      warehouse_id: warehouse ? warehouse.warehouse_id : null,
      warehouse_name: warehouse ? warehouse.warehouse_name : null,
      warehouse_region: warehouse ? warehouse.region : null,
      courier_id: courier ? courier.courier_id : null,
      courier_name: courier ? courier.courier_provider : null,
      courier_region: courier ? 'Nasional' : null,
      ground_truth_incident: data.reviewGroundTruths[r.review_id]
    });
  });

  const outputData = {
    incidents: data.INCIDENTS,
    records: flatRecords
  };

  const outputPath = path.join(DATA_DIR, 'analytics_traceability_dataset.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  const csvOutputPath = path.join(DATA_DIR, 'analytics_traceability_dataset.csv');
  fs.writeFileSync(csvOutputPath, arrayToCSV(flatRecords));

  const incidentsCsvOutputPath = path.join(DATA_DIR, 'ground_truth_incidents.csv');
  fs.writeFileSync(incidentsCsvOutputPath, arrayToCSV(data.INCIDENTS));

  console.log(`Local dataset generated successfully at ${outputPath} and ${csvOutputPath}`);
  console.log(`Ground truth incidents generated successfully at ${incidentsCsvOutputPath}`);
  console.log(`Total Joined Analytical Records: ${flatRecords.length}`);
  console.log(`Total Ground Truth Incidents: ${data.INCIDENTS.length}`);
}

run().catch(err => {
  console.error('Local dataset generation failed:', err);
  process.exit(1);
});
