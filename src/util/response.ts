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
 * @description Returns error response object
 * @param message {string} Error message
 */
const error = (errors: Array<ResponseItem> | ResponseItem) => ({
  errors,
});

export {
  success,
  error,
  ResponseItem,
};
