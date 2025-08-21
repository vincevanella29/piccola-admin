// useVanellixLogin.jsx
import { useState } from 'react';
import { useLoginWithEmail, useLoginWithSms, usePrivy } from '@privy-io/react-auth';

const useVanellixLogin = ({ onClose }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { sendCode: sendEmailCode, loginWithCode: loginEmail } = useLoginWithEmail({
    onError: (err) => setErrorMsg(err.message || 'Error en el inicio de sesión con email'),
  });

  const { sendCode: sendSmsCode, loginWithCode: loginSms } = useLoginWithSms({
    onError: (err) => setErrorMsg(err.message || 'Error en el inicio de sesión con teléfono'),
  });

  const { login: privyLogin } = usePrivy();

  const handleSelectMethod = (method) => {
    setErrorMsg('');
    setSelectedMethod(method);
    if (['google', 'twitter', 'wallet'].includes(method)) {
      privyLogin({ loginMethods: [method] });
      onClose();
    }
  };

  const handleSendCode = async () => {
    setErrorMsg('');
    try {
      if (selectedMethod === 'email') {
        await sendEmailCode(email);
      } else if (selectedMethod === 'phone') {
        await sendSmsCode(phone);
      }
      setShowCodeInput(true);
    } catch (err) {
      setErrorMsg(err.message || 'Error enviando código');
    }
  };

  const handleLoginWithCode = async () => {
    setErrorMsg('');
    try {
      if (selectedMethod === 'email') {
        await loginEmail(email, code);
      } else if (selectedMethod === 'phone') {
        await loginSms(phone, code);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error verificando código');
    }
  };

  return {
    selectedMethod,
    email,
    setEmail,
    phone,
    setPhone,
    code,
    setCode,
    showCodeInput,
    errorMsg,
    handleSelectMethod,
    handleSendCode,
    handleLoginWithCode,
  };
};

export default useVanellixLogin;

