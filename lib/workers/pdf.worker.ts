import { generateSettlementInvoiceBlob, generateSettlementInvoicesBatchBlob } from '../utils/pdf';

self.onmessage = async (event) => {
  const { type, payload, id } = event.data;
  
  try {
    let result;
    if (type === 'SINGLE') {
      result = await generateSettlementInvoiceBlob(payload.settlement, payload.merchant);
    } else if (type === 'BATCH') {
      result = await generateSettlementInvoicesBatchBlob(payload.settlements, payload.merchant);
    }
    self.postMessage({ id, success: true, result });
  } catch (error: any) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
