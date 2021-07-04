interface ResponseItem {
  code: string,
  message: string,
}

/**
 * @description Returns success response object
 * @param result {array|ResponseItem} response items
 */
const success = (result: Array<ResponseItem> | ResponseItem) => ({
  result,
});

/**
 * @description Returns error response array
 * @param err {ResponseItem} Error object
 */
const error = (errors: Array<ResponseItem>) => ({
  errors,
});

export {
  success,
  error,
  ResponseItem,
};
