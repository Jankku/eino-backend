// Only normalized, quoted lexemes are interpreted as tsquery syntax.
// Keep each input token separate to preserve the search API's any-token matching.
export const prefixSearchQuery = `WITH search_query AS (
  SELECT query_index, string_agg(quote_literal(lexeme) || ':*', ' & ')::tsquery AS query
  FROM unnest($2::text[]) WITH ORDINALITY AS tokens(term, query_index)
  CROSS JOIN LATERAL unnest(tsvector_to_array(to_tsvector('english', term))) AS terms(lexeme)
  GROUP BY query_index
)`;
