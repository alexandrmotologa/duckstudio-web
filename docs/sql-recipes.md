# Analytical SQL recipes for DuckDB

This guide lists common analytical queries supported by DuckDB in DuckStudio Web.

## Profiling and inspection

### Instant statistical summary

Generate min, max, average, null counts, and approximate quantiles across every column in a table:

```sql
SUMMARIZE ecommerce_orders;
```

### Inspect schema metadata

```sql
DESCRIBE ecommerce_orders;
```

## Window functions and ranking

### Top N per category

Rank products by revenue within each category and return only the top 3:

```sql
SELECT 
  order_id,
  product_category,
  product_name,
  total_amount,
  dense_rank() OVER (PARTITION BY product_category ORDER BY total_amount DESC) AS category_rank
FROM ecommerce_orders
QUALIFY category_rank <= 3;
```

### Running total and cumulative revenue

```sql
SELECT 
  order_date,
  total_amount,
  sum(total_amount) OVER (ORDER BY order_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_revenue
FROM ecommerce_orders;
```

## Dynamic column operations

DuckDB provides `COLUMNS()` expressions to manipulate sets of columns without repeating their names:

### Select all columns except sensitive or high cardinality ones

```sql
SELECT 
  COLUMNS(* EXCLUDE (order_id, discount))
FROM ecommerce_orders
LIMIT 25;
```

### Apply a function across all numeric columns

```sql
SELECT 
  product_category,
  COLUMNS(*)::VARCHAR
FROM ecommerce_orders
LIMIT 10;
```

## Working with JSON files

DuckDB reads and parses JSON files with automatic schema detection:

### Querying fields directly

```sql
SELECT 
  repo,
  language,
  stars,
  forks
FROM github_repositories
WHERE stars > 10000
ORDER BY stars DESC;
```

### Unnesting JSON array elements

```sql
SELECT 
  repo,
  unnest(topics) AS topic
FROM github_repositories
LIMIT 30;
```

## Date and time aggregations

Group metrics into fixed time intervals:

```sql
SELECT 
  time_bucket(INTERVAL '1 month', order_date::DATE) AS month,
  count(*) AS total_orders,
  round(sum(total_amount), 2) AS monthly_revenue
FROM ecommerce_orders
GROUP BY 1
ORDER BY 1 ASC;
```
