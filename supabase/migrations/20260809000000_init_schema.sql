-- D:\Documents\Projects\aic-project\supabase\migrations\20260809000000_init_schema.sql

-- Drop existing views and tables to clean up schema
DROP VIEW IF EXISTS analytics_traceability_view CASCADE;
DROP TABLE IF EXISTS complaint_prediction CASCADE;
DROP TABLE IF EXISTS review_image CASCADE;
DROP TABLE IF EXISTS review CASCADE;
DROP TABLE IF EXISTS shipment CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS courier CASCADE;
DROP TABLE IF EXISTS warehouse CASCADE;
DROP TABLE IF EXISTS batch CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS factory CASCADE;
DROP TABLE IF EXISTS root_cause_predictions CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;

-- factory
CREATE TABLE IF NOT EXISTS factory (
    factory_id VARCHAR(100) PRIMARY KEY,
    factory_name VARCHAR(255) NOT NULL,
    city VARCHAR(150),
    province VARCHAR(150)
);

-- product
CREATE TABLE IF NOT EXISTS product (
    product_id VARCHAR(100) PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(150),
    brand VARCHAR(150),
    price NUMERIC(10,2)
);

-- batch
CREATE TABLE IF NOT EXISTS batch (
    batch_id VARCHAR(100) PRIMARY KEY,
    factory_id VARCHAR(100) NOT NULL REFERENCES factory(factory_id) ON DELETE CASCADE,
    production_date DATE NOT NULL,
    expiry_date DATE,
    shift VARCHAR(100)
);

-- warehouse
CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id VARCHAR(100) PRIMARY KEY,
    warehouse_name VARCHAR(255) NOT NULL,
    city VARCHAR(150),
    region VARCHAR(150)
);

-- courier
CREATE TABLE IF NOT EXISTS courier (
    courier_id VARCHAR(100) PRIMARY KEY,
    courier_provider VARCHAR(255) NOT NULL
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) REFERENCES product(product_id) ON DELETE SET NULL,
    batch_id VARCHAR(100) REFERENCES batch(batch_id) ON DELETE SET NULL,
    warehouse_id VARCHAR(100) REFERENCES warehouse(warehouse_id) ON DELETE SET NULL,
    order_date DATE NOT NULL,
    processed_date DATE,
    packer_shift VARCHAR(100),
    quantity INTEGER DEFAULT 1
);

-- shipment
CREATE TABLE IF NOT EXISTS shipment (
    shipment_id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    courier_id VARCHAR(100) REFERENCES courier(courier_id) ON DELETE SET NULL,
    ship_date DATE,
    delivery_date DATE,
    delivery_status VARCHAR(100)
);

-- review
CREATE TABLE IF NOT EXISTS review (
    review_id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    review_text TEXT,
    review_date DATE NOT NULL
);

-- review_image
CREATE TABLE IF NOT EXISTS review_image (
    image_id VARCHAR(100) PRIMARY KEY,
    review_id VARCHAR(100) NOT NULL REFERENCES review(review_id) ON DELETE CASCADE,
    image_path TEXT NOT NULL
);

-- complaint_prediction
CREATE TABLE IF NOT EXISTS complaint_prediction (
    prediction_id VARCHAR(100) PRIMARY KEY,
    review_id VARCHAR(100) NOT NULL REFERENCES review(review_id) ON DELETE CASCADE,
    complaint_type VARCHAR(150) NOT NULL,
    aspect VARCHAR(150),
    severity VARCHAR(100),
    confidence NUMERIC(4,3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- incidents (Ground Truth Evaluator)
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    incident_type VARCHAR(150) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    injected_rate NUMERIC(4,3) NOT NULL
);

-- root_cause_predictions (Evaluation Output)
CREATE TABLE IF NOT EXISTS root_cause_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type VARCHAR(150) NOT NULL,
    detected_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    detected_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    candidate_type VARCHAR(100) NOT NULL,
    candidate_id VARCHAR(100) NOT NULL,
    confidence NUMERIC(4,3) NOT NULL,
    predicted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytical view mapping flat representation for NLP anomaly scripts
CREATE OR REPLACE VIEW analytics_traceability_view AS
SELECT
    r.review_id AS review_id,
    r.rating AS review_score,
    NULL AS review_comment_title, -- Ponytail: Gambar 1 tidak memiliki title, hanya review_text.
    r.review_text AS review_comment_message,
    r.review_date::text AS review_creation_date,
    o.order_id AS order_id,
    'delivered' AS order_status, -- Default fallback status
    o.order_date::text AS order_purchase_timestamp,
    s.delivery_date::text AS order_delivered_customer_date,
    p.price AS item_price,
    0.0 AS item_freight_value, -- Default fallback
    p.product_id AS product_id,
    p.category AS product_category,
    b.batch_id AS batch_id,
    b.production_date::text AS batch_production_date,
    f.factory_id AS factory_id,
    f.factory_name AS factory_name,
    f.province AS factory_region,
    s.shipment_id AS shipment_id,
    s.ship_date::text AS shipment_date,
    s.delivery_date::text AS shipment_delivery_date,
    w.warehouse_id AS warehouse_id,
    w.warehouse_name AS warehouse_name,
    w.region AS warehouse_region,
    c.courier_id AS courier_id,
    c.courier_provider AS courier_name,
    NULL AS courier_region -- Default fallback
FROM review r
JOIN orders o ON r.order_id = o.order_id
LEFT JOIN product p ON o.product_id = p.product_id
LEFT JOIN batch b ON o.batch_id = b.batch_id
LEFT JOIN factory f ON b.factory_id = f.factory_id
LEFT JOIN shipment s ON o.order_id = s.order_id
LEFT JOIN warehouse w ON o.warehouse_id = w.warehouse_id
LEFT JOIN courier c ON s.courier_id = c.courier_id;
