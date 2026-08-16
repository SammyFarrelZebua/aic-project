CREATE OR REPLACE VIEW product_stats_view AS
SELECT 
    p.product_id,
    p.product_name,
    p.category,
    p.brand,
    p.price,
    COUNT(DISTINCT o.order_id) AS order_count,
    COUNT(DISTINCT c.prediction_id) AS complaint_count,
    CASE 
        WHEN COUNT(DISTINCT o.order_id) > 0 THEN (COUNT(DISTINCT c.prediction_id)::float / COUNT(DISTINCT o.order_id)::float)
        ELSE 0 
    END AS complaint_ratio,
    CASE 
        WHEN COUNT(DISTINCT o.order_id) > 0 AND (COUNT(DISTINCT c.prediction_id)::float / COUNT(DISTINCT o.order_id)::float) > 0.1 THEN true
        ELSE false 
    END AS needs_alert
FROM product p
LEFT JOIN orders o ON p.product_id = o.product_id
LEFT JOIN review r ON o.order_id = r.order_id
LEFT JOIN complaint_prediction c ON r.review_id = c.review_id
GROUP BY p.product_id, p.product_name, p.category, p.brand, p.price;
