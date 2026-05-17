import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CheckCircle2, Copy, KeyRound, AlertCircle, Check, ShieldCheck, Terminal } from 'lucide-react';

const Dashboard = ({ 
  partner, 
  error, 
  newCredentials, 
  copied, 
  loading, 
  handleCopy, 
  handleGenerateCredentials, 
  handleRecoverCredentials 
}) => {
  const { t } = useTranslation();
  const [activeCodeTab, setActiveCodeTab] = useState('python');

  const pythonExample = `import os
import requests
import json
import time
import hashlib
from dilithium_py.dilithium import Dilithium2
from mnemonic import Mnemonic

# 1. Configuración de Credenciales B2B
PARTNER_ID = "${partner?._id || 'TU_PARTNER_ID'}"
ALLOCATION_ID = "ID_DE_LA_PROMOCION_B2B"

# 🔒 POR SEGURIDAD: Nunca pongas tu Mnemonic en el código. Usa variables de entorno (.env)
MNEMONIC = os.getenv("B2B_MNEMONIC") 
if not MNEMONIC:
    raise ValueError("El Mnemonic no está configurado en las variables de entorno")

# 2. Reconstruir Llaves Dilithium desde el Mnemonic
entropy = bytes(Mnemonic("english").to_entropy(MNEMONIC))
dili_seed = hashlib.sha384(entropy).digest()
Dilithium2.set_drbg_seed(dili_seed)
pk, sk = Dilithium2.keygen()

# 3. Preparar el Payload
payload = {
    "partner_id": PARTNER_ID,
    "allocation_id": ALLOCATION_ID,
    "target_email": "cliente@example.com"
}
body_bytes = json.dumps(payload).encode('utf-8')

# 4. Firmar la Petición Criptográficamente
signature = Dilithium2.sign(sk, body_bytes)
nonce = str(int(time.time() * 1000))

# 5. Enviar Petición a la API de Vanellix
headers = {
    "Content-Type": "application/json",
    "X-Dilithium-Signature": signature.hex(),
    "X-Dilithium-PK": pk.hex(),
    "X-Dilithium-Nonce": nonce,
    "X-Dilithium-Timestamp": str(time.time())
}

response = requests.post(
    "https://api.vanellix.com/api/public/b2b/distribute",
    headers=headers,
    data=body_bytes
)

print(response.json())`;

  const nodeExample = `require('dotenv').config(); // Cargar variables de entorno
const axios = require('axios');
const crypto = require('crypto');
// Nota: Dilithium2 requiere un wrapper nativo o Wasm en Node.js
// Te recomendamos usar nuestra librería Python para firmar en el backend.

const PARTNER_ID = "${partner?._id || 'TU_PARTNER_ID'}";
const ALLOCATION_ID = "ID_DE_LA_PROMOCION_B2B";

// 🔒 POR SEGURIDAD: Carga la frase secreta desde un archivo .env
const MNEMONIC = process.env.B2B_MNEMONIC;
if (!MNEMONIC) throw new Error("Falta B2B_MNEMONIC en el archivo .env");

const payload = {
  partner_id: PARTNER_ID,
  allocation_id: ALLOCATION_ID,
  target_email: "cliente@example.com"
};

const bodyString = JSON.stringify(payload);

// La firma DEBE ser generada con Dilithium2 usando el MNEMONIC
// const signatureHex = signWithDilithium(secretKey, Buffer.from(bodyString));

const headers = {
  "Content-Type": "application/json",
  "X-Dilithium-Signature": "TU_FIRMA_HEX_AQUI",
  "X-Dilithium-PK": "TU_LLAVE_PUBLICA_HEX_AQUI",
  "X-Dilithium-Nonce": Date.now().toString(),
  "X-Dilithium-Timestamp": (Date.now() / 1000).toString()
};

axios.post('https://api.vanellix.com/api/public/b2b/distribute', payload, { headers })
  .then(res => console.log(res.data))
  .catch(err => console.error(err.response?.data || err));`;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-matrix-green/10 flex items-center justify-center text-matrix-green">
            <Building2 size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
              {partner.company_name}
            </h1>
            <p className="text-matrix-green font-medium flex items-center gap-2 mt-1">
              <CheckCircle2 size={16} /> {t('b2b.verified_partner')}
            </p>
          </div>
        </div>
        
        {/* Partner ID Display */}
        <div className="px-4 py-2 bg-light-surface-secondary/50 dark:bg-[#1a1a1a] rounded-xl border border-light-border/50 dark:border-white/10 flex items-center gap-3 shadow-sm">
          <div className="text-xs">
            <span className="text-light-text-secondary dark:text-gray-400 block mb-0.5">Partner ID</span>
            <span className="font-mono text-light-text-primary dark:text-gray-200">{partner._id}</span>
          </div>
          <button 
            onClick={() => handleCopy(partner._id)}
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-light-text-secondary dark:text-gray-400 hover:text-matrix-green dark:hover:text-white transition-colors"
            title="Copiar Partner ID"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Allocations */}
        <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-sm">
          <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6">
            {t('b2b.promotions_quota')}
          </h3>
          {partner.allocations?.length === 0 ? (
            <p className="text-light-text-secondary dark:text-dark-text-secondary">{t('b2b.no_promotions')}</p>
          ) : (
            <div className="space-y-4">
              {partner.allocations.map(a => (
                <div key={a._id} className="p-4 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50 group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{a.promotion_name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Allocation ID: <span className="font-mono">{a._id}</span>
                        </p>
                        <button 
                          onClick={() => handleCopy(a._id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary dark:text-gray-400 hover:text-matrix-green"
                          title="Copiar Allocation ID"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-matrix-green/10 text-matrix-green rounded-lg">
                      {a.claimed_count} / {a.total_quota} {t('b2b.used')}
                    </span>
                  </div>
                  <div className="w-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary rounded-full h-2 mt-3">
                    <div className="bg-matrix-green h-2 rounded-full" style={{ width: `${Math.min(100, (a.claimed_count / a.total_quota) * 100)}%` }}></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <div>{t('b2b.max_per_user')}: {a.max_per_user}</div>
                    <div>{t('b2b.max_per_day')}: {a.max_per_day}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Integration Credentials & Guide */}
        <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{t('b2b.api_credentials')}</h3>

          {error && (
            <div className="p-4 rounded-xl bg-light-error/10 text-light-error dark:text-dark-error flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!partner.has_credentials && !newCredentials ? (
            <div className="p-6 rounded-2xl bg-matrix-green/5 border border-matrix-green/20 text-center">
              <KeyRound size={32} className="mx-auto text-matrix-green mb-4" />
              <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                {t('b2b.generate_credentials_title')}
              </h4>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">
                {t('b2b.generate_credentials_desc')}
              </p>
              <button onClick={handleGenerateCredentials} className="px-6 py-3 bg-matrix-green hover:opacity-90 text-white rounded-xl font-medium transition-opacity">
                {t('b2b.generate_btn')}
              </button>
            </div>
          ) : newCredentials ? (
            <div className="p-6 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
              <h4 className="font-semibold text-yellow-600 dark:text-yellow-500 flex items-center gap-2 mb-4">
                <AlertCircle size={20} /> {t('b2b.save_mnemonic_title')}
              </h4>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                {t('b2b.save_mnemonic_desc')}
              </p>
              <div className="p-4 bg-light-surface dark:bg-dark-surface-secondary border border-light-border/50 dark:border-dark-border/50 rounded-xl relative group">
                <code className="text-sm text-light-text-primary dark:text-dark-text-primary break-all">{newCredentials.mnemonic}</code>
                <button onClick={() => handleCopy(newCredentials.mnemonic)} className="absolute top-2 right-2 p-2 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                  {copied ? <Check size={16} className="text-matrix-green" /> : <Copy size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-matrix-green/5 border border-matrix-green/20">
              <div className="flex items-start gap-4 mb-4">
                <CheckCircle2 size={24} className="text-matrix-green shrink-0" />
                <div>
                  <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
                    {t('b2b.active_credentials_title')}
                  </h4>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {t('b2b.active_credentials_desc')}
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-matrix-green/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-light-text-secondary dark:text-gray-400">
                  ¿Olvidaste tu frase secreta? Requiere firma Web3 para revelar.
                </p>
                <button
                  onClick={handleRecoverCredentials}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-light-surface dark:bg-[#1a1a1a] hover:bg-light-surface-secondary dark:hover:bg-[#2a2a2a] border border-light-border/50 dark:border-white/10 text-light-text-primary dark:text-gray-200 rounded-xl font-medium transition-all text-sm shadow-sm whitespace-nowrap"
                >
                  <ShieldCheck size={16} className="text-matrix-green" />
                  <span>Revelar Frase Secreta</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h4 className="text-lg font-bold text-light-text-primary dark:text-gray-200 border-b border-light-border/50 dark:border-white/10 pb-2">
              {t('b2b.integration_guide', { defaultValue: 'Guía de Integración Rápida' })}
            </h4>
            
            {/* Step 1: Installation */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-matrix-green/20 text-matrix-green flex items-center justify-center font-bold text-xs">1</div>
                <h5 className="font-semibold text-light-text-primary dark:text-gray-200">Instala las dependencias</h5>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-gray-400 pl-9">
                Dependiendo de tu entorno, instala las librerías necesarias en tu terminal:
              </p>
              <div className="pl-9">
                <div className="rounded-xl bg-[#0d1117] border border-white/10 p-4 font-mono text-xs text-gray-300 relative group shadow-inner">
                  <div className="text-gray-500 mb-1"># Para Python</div>
                  <div className="text-[#58a6ff]">pip <span className="text-[#e6edf3]">install requests dilithium-py mnemonic</span></div>
                  <div className="text-gray-500 mt-3 mb-1"># Para Node.js</div>
                  <div className="text-[#58a6ff]">npm <span className="text-[#e6edf3]">install axios crypto mnemonic</span></div>
                  <button
                    onClick={() => handleCopy("pip install requests dilithium-py mnemonic\nnpm install axios crypto mnemonic")}
                    className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Implementation */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-matrix-green/20 text-matrix-green flex items-center justify-center font-bold text-xs">2</div>
                <h5 className="font-semibold text-light-text-primary dark:text-gray-200">Ejecuta el código</h5>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-gray-400 pl-9">
                Copia y pega este código en tu servidor. Reemplaza <code className="bg-light-surface-secondary dark:bg-[#222] px-1.5 py-0.5 rounded text-matrix-green">TU_PARTNER_ID</code> y <code className="bg-light-surface-secondary dark:bg-[#222] px-1.5 py-0.5 rounded text-matrix-green">TU_MNEMONIC</code>.
              </p>

              <div className="pl-9">
                <div className="rounded-2xl bg-[#0d1117] border border-white/10 overflow-hidden shadow-2xl">
                  {/* Header / Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161b22] gap-4 sm:gap-0">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 hidden sm:flex">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-400">distribute_coupon.{activeCodeTab === 'python' ? 'py' : 'js'}</span>
                      </div>
                    </div>

                    <div className="flex p-0.5 bg-black/40 rounded-lg border border-white/5 w-full sm:w-auto">
                      <button
                        onClick={() => setActiveCodeTab('python')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          activeCodeTab === 'python' ? 'bg-[#21262d] text-white border border-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Python
                      </button>
                      <button
                        onClick={() => setActiveCodeTab('node')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          activeCodeTab === 'node' ? 'bg-[#21262d] text-white border border-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Node.js
                      </button>
                    </div>
                  </div>

                  {/* Code Body */}
                  <div className="relative group p-4 sm:p-5 overflow-x-auto bg-[#0d1117]">
                    <pre className="text-[13px] leading-relaxed font-mono text-[#e6edf3] whitespace-pre-wrap">
                      {activeCodeTab === 'python' ? pythonExample : nodeExample}
                    </pre>
                    
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(activeCodeTab === 'python' ? pythonExample : nodeExample)}
                      className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 bg-[#21262d] hover:bg-[#30363d] text-gray-300 rounded-lg border border-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 shadow-lg flex items-center justify-center"
                      title="Copiar código"
                    >
                      {copied ? <Check size={16} className="text-matrix-green" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
