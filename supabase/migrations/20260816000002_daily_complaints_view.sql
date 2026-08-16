-- Create daily_complaints_view to aggregate review count, low ratings count, and complaint predictions daily.
CREATE OR REPLACE VIEW daily_complaints_view AS
WITH review_counts AS (
    SELECT
        review_date AS date,
        COUNT(review_id) AS reviews,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) AS low_ratings
    FROM
        review
    GROUP BY
        review_date
),
complaint_counts AS (
    SELECT
        r.review_date AS date,
        COUNT(CASE WHEN cp.complaint_type = 'PRODUCT_DEFECT' THEN 1 END) AS defects,
        COUNT(CASE WHEN cp.complaint_type = 'PACKAGING_DAMAGE' THEN 1 END) AS damages,
        COUNT(CASE WHEN cp.complaint_type = 'LATE_DELIVERY' THEN 1 END) AS delays
    FROM
        complaint_prediction cp
    JOIN
        review r ON cp.review_id = r.review_id
    GROUP BY
        r.review_date
)
SELECT
    rc.date::text AS date,
    rc.reviews,
    rc.low_ratings,
    COALESCE(cc.defects, 0) AS defects,
    COALESCE(cc.damages, 0) AS damages,
    COALESCE(cc.delays, 0) AS delays
FROM
    review_counts rc
LEFT JOIN
    complaint_counts cc ON rc.date = cc.date;
