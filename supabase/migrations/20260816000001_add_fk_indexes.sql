-- Add indexes for foreign keys to prevent sequential scans during JOINs and CASCADE operations
CREATE INDEX IF NOT EXISTS idx_batch_factory_id ON batch(factory_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_id ON orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shipment_order_id ON shipment(order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_courier_id ON shipment(courier_id);
CREATE INDEX IF NOT EXISTS idx_review_order_id ON review(order_id);
CREATE INDEX IF NOT EXISTS idx_review_image_review_id ON review_image(review_id);
CREATE INDEX IF NOT EXISTS idx_complaint_prediction_review_id ON complaint_prediction(review_id);
