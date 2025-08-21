import api from './api.jsx';

export async function createPresaleApi({encodedData, signature, plainText, appState}) {
  return api({
    method: 'POST',
    endpoint: '/presale/create',
    data: {
      encodedData,
      signature,
      plainData: plainText,
      wallet: appState.account,
      token: appState.accessToken,
    },
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${appState.accessToken}`,
      'X-Wallet-Address': appState.account,
    },
  });
}

// Obtener tokens de pago
export async function fetchPaymentTokens() {
    try {
      return await api({
        method: 'get',
        endpoint: '/payment_tokens',
        withCredentials: false,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching payment tokens:', err);
      throw new Error(err.message || 'Error fetching payment tokens');
    }
}

// Obtener presale de una compañía por companyId
export async function fetchPresaleByCompanyId(companyId) {
  try {
    return await api({
      method: 'get',
      endpoint: `/presale/${companyId}`,
      withCredentials: false,
    });
  } catch (err) {
    console.error('preSaleData.jsx - Error fetching presale by companyId:', err);
    throw new Error(err.message || 'Error fetching presale by companyId');
  }
}

// Comprar tokens en una presale
export async function buyPresaleToken({ presale_id, amount, wallet, signature, plainData, appState }) {
  try {
    // Ensure amount is sent as a string without 'n' (BigInt)
    let cleanAmount = amount;
    if (typeof amount === 'bigint') {
      cleanAmount = amount.toString();
    } else if (typeof amount === 'number') {
      cleanAmount = amount.toString();
    } else if (typeof amount === 'string' && amount.endsWith('n')) {
      cleanAmount = amount.slice(0, -1);
    }
    return await api({
      method: 'POST',
      endpoint: '/presale/buy',
      data: {
        presale_id,
        amount: cleanAmount,
        wallet,
        signature,
        plainData,
      },
      withCredentials: true,
      headers: {
        ...(appState?.accessToken ? { Authorization: `Bearer ${appState.accessToken}` } : {}),
        ...(appState?.account ? { 'X-Wallet-Address': appState.account } : {})
      }
    });
  } catch (err) {
    console.error('preSaleData.jsx - Error buying presale:', err);
    throw new Error(err.message || 'Error buying presale');
  }
}

// Obtener todas las presales (paginadas)
export async function fetchAllPresales(page = 1, pageSize = 10) {
  try {
    return await api({
      method: 'get',
      endpoint: `/presales?page=${page}&page_size=${pageSize}`,
      withCredentials: false,
    });
  } catch (err) {
    console.error('preSaleData.jsx - Error fetching presales:', err);
    throw new Error(err.message || 'Error fetching presales');
  }
}