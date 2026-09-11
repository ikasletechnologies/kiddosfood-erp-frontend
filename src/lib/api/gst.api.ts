import api from './base';

export const gstApi = {
  verify: (gstin: string) => api.get(`/api/gst/verify/${gstin}`),
};
