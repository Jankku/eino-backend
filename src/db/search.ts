// Normalize user text before constructing prefix syntax. Only quoted lexemes,
// never raw user text, are interpreted as a tsquery. Reuse it for matching and ranking.
export const prefixSearchQuery = `WITH search_query AS (
  SELECT string_agg(quote_literal(lexeme) || ':*', ' & ')::tsquery AS query
  FROM unnest(tsvector_to_array(to_tsvector('english', $2))) AS terms(lexeme)
)`;
