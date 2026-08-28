export const getErrorMessage = (err, defaultMsg = 'An unexpected error occurred. Please try again.') => {
  if (err?.response?.data?.error?.message) {
    return err.response.data.error.message;
  }
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  return defaultMsg;
};
