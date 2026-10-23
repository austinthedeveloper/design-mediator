-- Legacy schema (being retired). Kept for reference during migration.
CREATE TABLE tbl_item (
  item_id        SERIAL PRIMARY KEY,
  item_name      VARCHAR(255) NOT NULL,
  item_desc      TEXT,
  sku            VARCHAR(20) NOT NULL UNIQUE,
  price          NUMERIC(10, 2) NOT NULL,
  compare_price  NUMERIC(10, 2),
  qty_on_hand    INTEGER DEFAULT 0,
  track_qty      BOOLEAN DEFAULT TRUE,
  is_active      CHAR(1) DEFAULT 'Y',
  weight_oz      NUMERIC(8, 2),
  cat_id         INTEGER REFERENCES tbl_category(cat_id)
);

CREATE TABLE tbl_item_image (
  image_id   SERIAL PRIMARY KEY,
  item_id    INTEGER REFERENCES tbl_item(item_id),
  url        VARCHAR(500) NOT NULL,
  sort_order INTEGER DEFAULT 0
);
