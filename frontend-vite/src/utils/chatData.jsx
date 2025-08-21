import api from './api.jsx';

export async function fetchChatResponse({ message, context, isCustom, accessToken }) {
  return api({
    method: 'POST',
    endpoint: '/chat/send',
    data: { message, context, is_custom: isCustom },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function fetchChatHistory({ accessToken }) {
  return api({
    method: 'GET',
    endpoint: '/chat/history',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}