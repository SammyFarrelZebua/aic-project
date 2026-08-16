ALTER TABLE complaint_prediction
ADD COLUMN prob_product_defect NUMERIC(4,3) DEFAULT 0,
ADD COLUMN prob_packaging_damage NUMERIC(4,3) DEFAULT 0,
ADD COLUMN prob_late_delivery NUMERIC(4,3) DEFAULT 0;
