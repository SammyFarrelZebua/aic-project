-- The Ulasan (Reviews) page and /api/reviews query `review` ordered by
-- review_date DESC, joined with the complaint_prediction embed. Without an
-- index on review_date, Postgres falls back to a full sort over all ~15k
-- rows for every request, which combined with the join is slow enough to
-- exceed the statement timeout -- the API then returns a 500, and the
-- frontend (which doesn't check res.ok) silently renders the empty state
-- ("Tidak ada ulasan yang ditemukan") instead of surfacing the error.
CREATE INDEX IF NOT EXISTS idx_review_review_date ON review(review_date DESC);
