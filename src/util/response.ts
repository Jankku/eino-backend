export interface ResponseItem {
  name: string;
  message: string;
}

/**
 * @description Returns success response object
 * @param results {array} Response item array
 */
export const success = (results: Array<unknown>) => ({ results });
