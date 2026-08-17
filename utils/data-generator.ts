import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { generateReviewText } from './review-corpus';

export const OLIST_BASE_URL = 'https://raw.githubusercontent.com/VictorGuedes/Brazilian-E-Commerce-Public-Dataset-examples/master/dataset';
export const DATA_DIR = path.join(process.cwd(), 'data');

export const FILES = {
  products: 'olist_products_dataset.csv',
  orders: 'olist_orders_dataset.csv',
  order_items: 'olist_order_items_dataset.csv',
  reviews: 'olist_order_reviews_dataset.csv'
};

export async function downloadFile(url: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dest)) {
    return;
  }

  console.log(`Downloading ${path.basename(dest)}...`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r' && !inQuotes) {
      // skip
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      let val = values[index] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      record[header] = val;
    });
    records.push(record);
  }
  return records;
}

export function hashStringToId(str: string, mod: number): number {
  const s = str || '';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % mod;
}

export async function generateCoreDataset(subsetCount: number = 15000) {
  for (const filename of Object.values(FILES)) {
    const url = `${OLIST_BASE_URL}/${filename}`;
    const dest = path.join(DATA_DIR, filename);
    await downloadFile(url, dest);
  }

  const FACTORIES = [
    { factory_id: 'fact-a', factory_name: 'Factory A', province: 'Jawa Timur' },
    { factory_id: 'fact-b', factory_name: 'Factory B', province: 'Jawa Barat' },
    { factory_id: 'fact-c', factory_name: 'Factory C', province: 'Jawa Tengah' },
    { factory_id: 'fact-d', factory_name: 'Factory D', province: 'Banten' },
    { factory_id: 'fact-e', factory_name: 'Factory E', province: 'Sumatera Utara' }
  ];
  const factoryC = FACTORIES.find(f => f.factory_id === 'fact-c')!;

  const WAREHOUSES = [
    { warehouse_id: 'wh-north', warehouse_name: 'Warehouse North', region: 'DKI Jakarta' },
    { warehouse_id: 'wh-east', warehouse_name: 'Warehouse East', region: 'Jawa Timur' },
    { warehouse_id: 'wh-south', warehouse_name: 'Warehouse South', region: 'DI Yogyakarta' },
    { warehouse_id: 'wh-west', warehouse_name: 'Warehouse West', region: 'Jawa Barat' },
    { warehouse_id: 'wh-central', warehouse_name: 'Warehouse Central', region: 'Jawa Tengah' }
  ];
  const warehouseSouth = WAREHOUSES.find(w => w.warehouse_id === 'wh-south')!;

  const COURIERS = [
    { courier_id: 'cour-std', courier_provider: 'Courier Standard Mail' },
    { courier_id: 'cour-air', courier_provider: 'Courier Express Air' },
    { courier_id: 'cour-fast', courier_provider: 'Courier Fast Express' },
    { courier_id: 'cour-eco', courier_provider: 'Courier Eco Road' },
    { courier_id: 'cour-local', courier_provider: 'Courier Local Cargo' }
  ];
  const courierFastExpress = COURIERS.find(c => c.courier_id === 'cour-fast')!;

  const rawOrders = parseCSV(path.join(DATA_DIR, FILES.orders));
  const rawItems = parseCSV(path.join(DATA_DIR, FILES.order_items));
  const rawProducts = parseCSV(path.join(DATA_DIR, FILES.products));
  const rawReviews = parseCSV(path.join(DATA_DIR, FILES.reviews));

  const ordersSubset = rawOrders.slice(0, subsetCount);
  const orderIdsSet = new Set(ordersSubset.map(o => o.order_id));

  const itemsSubset = rawItems.filter(item => orderIdsSet.has(item.order_id));
  const productIdsSet = new Set(itemsSubset.map(item => item.product_id));
  const productsSubset = rawProducts.filter(p => productIdsSet.has(p.product_id));
  const reviewsSubset = rawReviews.filter(r => orderIdsSet.has(r.order_id));

  const productPrices: Record<string, number> = {};
  const productFreight: Record<string, number> = {};
  itemsSubset.forEach(item => {
    if (productPrices[item.product_id] === undefined) {
      productPrices[item.product_id] = parseFloat(item.price) || 0.0;
      productFreight[item.product_id] = parseFloat(item.freight_value) || 0.0;
    }
  });

  const formattedProducts = productsSubset.map(p => ({
    product_id: p.product_id,
    product_name: `Product ${p.product_id.substring(0, 8)}`,
    category: p.product_category_name || 'unknown',
    brand: 'Olist Brand',
    price: productPrices[p.product_id] || 0.0
  }));

  const productToFactoryId: Record<string, string> = {};
  productsSubset.forEach(p => {
    const factoryIndex = hashStringToId(p.product_id, FACTORIES.length);
    productToFactoryId[p.product_id] = FACTORIES[factoryIndex].factory_id;
  });

  const orderDateMap: Record<string, string> = {};
  const orderStatusMap: Record<string, string> = {};
  const orderDeliveredDateMap: Record<string, string | null> = {};
  ordersSubset.forEach(o => {
    orderDateMap[o.order_id] = o.order_purchase_timestamp;
    orderStatusMap[o.order_id] = o.order_status;
    orderDeliveredDateMap[o.order_id] = o.order_delivered_customer_date || null;
  });

  const uniqueBatches: Record<string, { batch_id: string; factory_id: string; production_date: string; expiry_date: string; shift: string }> = {};
  itemsSubset.forEach(item => {
    const orderDateStr = orderDateMap[item.order_id] || new Date().toISOString();
    const orderDate = new Date(orderDateStr);
    const monthKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
    const batchKey = `${item.product_id}_${monthKey}`;
    const generatedBatchId = `batch-${hashStringToId(batchKey, 1000000)}`;

    const duplicateBatchId = Object.values(uniqueBatches).some(b => b.batch_id === generatedBatchId);

    if (!uniqueBatches[batchKey] && !duplicateBatchId) {
      const factoryId = productToFactoryId[item.product_id] || FACTORIES[0].factory_id;
      const prodDate = new Date(orderDate);
      prodDate.setDate(prodDate.getDate() - 15);
      const expDate = new Date(prodDate);
      expDate.setFullYear(expDate.getFullYear() + 2);

      const shiftOptions = ['Morning', 'Evening', 'Night'];
      const shift = shiftOptions[hashStringToId(batchKey, shiftOptions.length)];

      uniqueBatches[batchKey] = {
        batch_id: generatedBatchId,
        factory_id: factoryId,
        production_date: prodDate.toISOString().substring(0, 10),
        expiry_date: expDate.toISOString().substring(0, 10),
        shift
      };
    }
  });

  const batchesList = Object.values(uniqueBatches);

  const orderItemsMap: Record<string, { product_id: string; batch_id: string | null; price: number; quantity: number }> = {};
  itemsSubset.forEach(item => {
    if (!orderItemsMap[item.order_id]) {
      const orderDateStr = orderDateMap[item.order_id] || new Date().toISOString();
      const orderDate = new Date(orderDateStr);
      const monthKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
      const batchKey = `${item.product_id}_${monthKey}`;
      const batch = uniqueBatches[batchKey];
      orderItemsMap[item.order_id] = {
        product_id: item.product_id,
        batch_id: batch ? batch.batch_id : null,
        price: parseFloat(item.price) || 0.0,
        quantity: 1
      };
    } else {
      orderItemsMap[item.order_id].quantity += 1;
    }
  });

  const orderShipmentsMap: Record<string, { warehouse_id: string; courier_id: string; ship_date: string; delivery_date: string | null }> = {};
  ordersSubset.forEach(o => {
    const warehouseIndex = hashStringToId(o.order_id, WAREHOUSES.length);
    const courierIndex = hashStringToId(o.order_id, COURIERS.length);
    const warehouse = WAREHOUSES[warehouseIndex];
    const courier = COURIERS[courierIndex];

    const purchaseDate = new Date(o.order_purchase_timestamp);
    const shipDate = new Date(purchaseDate);
    shipDate.setDate(shipDate.getDate() + 2);

    orderShipmentsMap[o.order_id] = {
      warehouse_id: warehouse.warehouse_id,
      courier_id: courier.courier_id,
      ship_date: shipDate.toISOString().substring(0, 10),
      delivery_date: o.order_delivered_customer_date ? o.order_delivered_customer_date : null
    };
  });

  for (const [orderId, s] of Object.entries(orderShipmentsMap)) {
    if (s.courier_id === courierFastExpress.courier_id) {
      const orderDateStr = orderDateMap[orderId];
      if (orderDateStr) {
        const dateStr = orderDateStr.substring(0, 10);
        const inCourFastWindow = dateStr >= '2018-06-01' && dateStr <= '2018-06-15';
        const courFastRate = inCourFastWindow ? 0.40 : 0.02;
        const prob = hashStringToId(orderId, 10000) / 10000;
        if (prob < courFastRate) {
          if (s.ship_date) {
            const dDate = new Date(s.ship_date);
            dDate.setDate(dDate.getDate() + 15);
            s.delivery_date = dDate.toISOString();
          }
        }
      }
    }
  }

  const formattedOrders = ordersSubset.map(o => {
    const itemInfo = orderItemsMap[o.order_id];
    const shipInfo = orderShipmentsMap[o.order_id];
    const purchaseDate = o.order_purchase_timestamp ? o.order_purchase_timestamp.substring(0, 10) : new Date().toISOString().substring(0, 10);
    const packerShiftOptions = ['Shift A', 'Shift B', 'Shift C'];
    const packerShift = packerShiftOptions[hashStringToId(o.order_id, packerShiftOptions.length)];

    return {
      order_id: o.order_id,
      product_id: itemInfo ? itemInfo.product_id : null,
      batch_id: itemInfo ? itemInfo.batch_id : null,
      warehouse_id: shipInfo ? shipInfo.warehouse_id : null,
      order_date: purchaseDate,
      processed_date: shipInfo ? shipInfo.ship_date : null,
      packer_shift: packerShift,
      quantity: itemInfo ? itemInfo.quantity : 1
    };
  });

  const uniqueShipmentIds = new Set<string>();
  const shipmentsList = Object.entries(orderShipmentsMap).map(([orderId, s]) => {
    const deliveryStatus = s.delivery_date ? 'delivered' : 'shipped';
    let shipmentId = `ship-${hashStringToId(orderId, 1000000)}`;

    let counter = 1;
    while (uniqueShipmentIds.has(shipmentId)) {
      shipmentId = `ship-${hashStringToId(orderId + counter, 1000000)}`;
      counter++;
    }
    uniqueShipmentIds.add(shipmentId);

    return {
      shipment_id: shipmentId,
      order_id: orderId,
      courier_id: s.courier_id,
      ship_date: s.ship_date,
      delivery_date: s.delivery_date ? s.delivery_date.substring(0, 10) : null,
      delivery_status: deliveryStatus
    };
  });

  const orderToEntitiesMap: Record<string, { factoryIds: string[]; warehouseId: string; courierId: string }> = {};
  itemsSubset.forEach(item => {
    if (!orderToEntitiesMap[item.order_id]) {
      orderToEntitiesMap[item.order_id] = { factoryIds: [], warehouseId: '', courierId: '' };
    }
    const factId = productToFactoryId[item.product_id];
    if (factId && !orderToEntitiesMap[item.order_id].factoryIds.includes(factId)) {
      orderToEntitiesMap[item.order_id].factoryIds.push(factId);
    }
  });

  Object.entries(orderShipmentsMap).forEach(([orderId, ship]) => {
    if (orderToEntitiesMap[orderId]) {
      orderToEntitiesMap[orderId].warehouseId = ship.warehouse_id || '';
      orderToEntitiesMap[orderId].courierId = ship.courier_id || '';
    }
  });

  const reviewGroundTruths: Record<string, string | null> = {};

  const formattedReviews = reviewsSubset.map(r => {
    let score = parseInt(r.review_score) || 5;
    let commentMessage = '';
    let groundTruthIncident: string | null = null;

    const entities = orderToEntitiesMap[r.order_id];
    const orderDateStr = orderDateMap[r.order_id];
    const purchaseTimeStr = orderDateStr ? orderDateStr.substring(0, 10) : '';
    const prob = hashStringToId(r.order_id, 10000) / 10000;

    const hasFactoryC = entities && entities.factoryIds.includes(factoryC.factory_id);
    const isWarehouseSouth = entities && entities.warehouseId === warehouseSouth.warehouse_id;
    const isCourierFast = entities && entities.courierId === courierFastExpress.courier_id;

    const inFactCWindow = purchaseTimeStr >= '2018-07-01' && purchaseTimeStr <= '2018-07-15';
    const inWhSouthWindow = purchaseTimeStr >= '2018-05-01' && purchaseTimeStr <= '2018-05-15';
    const inCourFastWindow = purchaseTimeStr >= '2018-06-01' && purchaseTimeStr <= '2018-06-15';

    const factCRate = inFactCWindow ? 0.45 : 0.01;
    const whSouthRate = inWhSouthWindow ? 0.35 : 0.01;
    const courFastRate = inCourFastWindow ? 0.40 : 0.02;

    if (hasFactoryC && (prob < factCRate)) {
      score = 1;
      commentMessage = generateReviewText(score, r.review_id, 'PRODUCT_DEFECT');
      groundTruthIncident = 'PRODUCT_DEFECT';
    } else if (isWarehouseSouth && (prob < whSouthRate)) {
      score = 2;
      commentMessage = generateReviewText(score, r.review_id, 'PACKAGING_DAMAGE');
      groundTruthIncident = 'PACKAGING_DAMAGE';
    } else if (isCourierFast && (prob < courFastRate)) {
      score = 1;
      commentMessage = generateReviewText(score, r.review_id, 'LATE_DELIVERY');
      groundTruthIncident = 'LATE_DELIVERY';
    } else {
      commentMessage = generateReviewText(score, r.review_id);
    }

    reviewGroundTruths[r.review_id] = groundTruthIncident;

    return {
      review_id: r.review_id,
      order_id: r.order_id,
      rating: score,
      review_text: commentMessage || null,
      review_date: r.review_creation_date ? r.review_creation_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
      _original_creation_date: r.review_creation_date 
    };
  });

  const uniqueReviews = new Map<string, typeof formattedReviews[0]>();
  formattedReviews.forEach(rev => {
    if (!uniqueReviews.has(rev.review_id)) {
      uniqueReviews.set(rev.review_id, rev);
    }
  });
  const reviewsList = Array.from(uniqueReviews.values());

  const INCIDENTS = [
    {
      entity_type: 'warehouse',
      entity_id: warehouseSouth.warehouse_id,
      incident_type: 'PACKAGING_DAMAGE',
      start_date: '2018-05-01T00:00:00.000Z',
      end_date: '2018-05-15T23:59:59.000Z',
      injected_rate: 0.35
    },
    {
      entity_type: 'courier',
      entity_id: courierFastExpress.courier_id,
      incident_type: 'LATE_DELIVERY',
      start_date: '2018-06-01T00:00:00.000Z',
      end_date: '2018-06-15T23:59:59.000Z',
      injected_rate: 0.40
    },
    {
      entity_type: 'factory',
      entity_id: factoryC.factory_id,
      incident_type: 'PRODUCT_DEFECT',
      start_date: '2018-07-01T00:00:00.000Z',
      end_date: '2018-07-15T23:59:59.000Z',
      injected_rate: 0.45
    }
  ];

  return {
    FACTORIES,
    WAREHOUSES,
    COURIERS,
    formattedProducts,
    batchesList,
    formattedOrders,
    shipmentsList,
    reviewsList,
    INCIDENTS,
    orderStatusMap,
    orderDateMap,
    orderDeliveredDateMap,
    productPrices,
    productFreight,
    reviewGroundTruths,
    uniqueBatches,
    orderItemsMap
  };
}
