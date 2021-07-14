interface ResponseItem {
  name: string,
  message: string,
}

/**
 * @description Returns success response object
 * @param results {array|ResponseItem} Response item array
 */
const success = (results: Array<any> | ResponseItem) => ({
  results,
});

export {
  success,
  ResponseItem,
};
